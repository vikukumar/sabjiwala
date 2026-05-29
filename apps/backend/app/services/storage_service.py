"""
Local storage service with thumbnail generation, optional encryption, and file optimization.
"""
import io
import os
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, Tuple
from uuid import UUID, uuid4

from PIL import Image
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.storage import FileMetadata

# Ensure uploads directories exist on start
STORAGE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "storage")


class StorageService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.base_dir = STORAGE_DIR
        self._ensure_folders()

    def _ensure_folders(self) -> None:
        """Create storage upload buckets folders."""
        for bucket in ["public", "private", "temp", "archive"]:
            os.makedirs(os.path.join(self.base_dir, bucket), exist_ok=True)
            os.makedirs(os.path.join(self.base_dir, bucket, "thumbnails"), exist_ok=True)

    def _generate_key(self) -> bytes:
        """Generate AES key."""
        return AESGCM.generate_key(bit_length=256)

    def _encrypt(self, data: bytes, key: bytes) -> bytes:
        """Encrypt bytes using AES-GCM."""
        aesgcm = AESGCM(key)
        nonce = os.urandom(12)
        # prepend nonce to the encrypted ciphertext
        return nonce + aesgcm.encrypt(nonce, data, None)

    def _decrypt(self, encrypted_data: bytes, key: bytes) -> bytes:
        """Decrypt bytes using AES-GCM."""
        nonce = encrypted_data[:12]
        ciphertext = encrypted_data[12:]
        aesgcm = AESGCM(key)
        return aesgcm.decrypt(nonce, ciphertext, None)

    async def save_file(
        self,
        file_bytes: bytes,
        original_filename: str,
        owner_id: Optional[UUID] = None,
        vendor_id: Optional[UUID] = None,
        bucket: str = "public",
        is_public: bool = True,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        encrypt_file: bool = False
    ) -> FileMetadata:
        """
        Save file to disk, create thumbnails if it is an image, encrypt if specified, and save db metadata.
        """
        file_extension = os.path.splitext(original_filename)[1].lower().replace(".", "")
        stored_filename = f"{uuid4().hex}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}.{file_extension}"
        
        # Paths
        file_relative_path = os.path.join(bucket, stored_filename)
        absolute_path = os.path.join(self.base_dir, file_relative_path)

        # Detect Mime type from extension as fallback
        import mimetypes
        mime_type, _ = mimetypes.guess_type(original_filename)
        mime_type = mime_type or "application/octet-stream"

        # Calculate checksum
        checksum = hashlib.sha256(file_bytes).hexdigest()
        file_size = len(file_bytes)

        # Optimization & Thumbnails
        width, height = None, None
        thumb_rel_path = None
        thumb_small_rel_path = None
        thumb_medium_rel_path = None

        is_image = mime_type.startswith("image/") and file_extension in ["jpg", "jpeg", "png", "webp"]

        if is_image:
            try:
                img = Image.open(io.BytesIO(file_bytes))
                width, height = img.size

                # WebP optimization if public image
                if bucket == "public" and file_extension != "webp":
                    # Convert to WebP
                    webp_io = io.BytesIO()
                    img.save(webp_io, format="WEBP", quality=80)
                    file_bytes = webp_io.getvalue()
                    file_size = len(file_bytes)
                    file_extension = "webp"
                    stored_filename = stored_filename.rsplit(".", 1)[0] + ".webp"
                    file_relative_path = os.path.join(bucket, stored_filename)
                    absolute_path = os.path.join(self.base_dir, file_relative_path)
                    mime_type = "image/webp"

                # Generate thumbnails
                sizes = {
                    "small": (150, 150),
                    "medium": (300, 300),
                    "large": (600, 600)
                }

                thumb_paths = {}
                for size_name, size in sizes.items():
                    thumb_img = img.copy()
                    thumb_img.thumbnail(size)
                    thumb_io = io.BytesIO()
                    thumb_img.save(thumb_io, format="WEBP", quality=75)
                    
                    thumb_stored_name = f"thumb_{size_name}_{stored_filename.rsplit('.', 1)[0]}.webp"
                    thumb_rel = os.path.join(bucket, "thumbnails", thumb_stored_name)
                    thumb_abs = os.path.join(self.base_dir, thumb_rel)
                    
                    with open(thumb_abs, "wb") as f:
                        f.write(thumb_io.getvalue())
                    
                    thumb_paths[size_name] = thumb_rel

                thumb_small_rel_path = thumb_paths["small"]
                thumb_medium_rel_path = thumb_paths["medium"]
                thumb_rel_path = thumb_paths["large"]

            except Exception as e:
                # Log exception and continue saving raw bytes without thumbnails
                width, height = None, None

        # Encryption logic
        is_encrypted = False
        enc_key_str = None
        if encrypt_file or bucket == "private":
            is_encrypted = True
            key = self._generate_key()
            file_bytes = self._encrypt(file_bytes, key)
            file_size = len(file_bytes)
            enc_key_str = key.hex()

        # Write file to disk
        with open(absolute_path, "wb") as f:
            f.write(file_bytes)

        # DB Metadata
        metadata = FileMetadata(
            owner_id=owner_id,
            vendor_id=vendor_id,
            original_filename=original_filename,
            stored_filename=stored_filename,
            file_path=file_relative_path,
            file_size=file_size,
            mime_type=mime_type,
            file_extension=file_extension,
            storage_bucket=bucket,
            is_encrypted=is_encrypted,
            encryption_key_id=enc_key_str,
            thumbnail_path=thumb_rel_path,
            thumbnail_small_path=thumb_small_rel_path,
            thumbnail_medium_path=thumb_medium_rel_path,
            width=width,
            height=height,
            checksum_sha256=checksum,
            is_public=is_public,
        )

        self.db.add(metadata)
        await self.db.flush()
        return metadata

    async def get_file_content(self, file_id: UUID) -> Tuple[bytes, FileMetadata]:
        """
        Retrieve file content from disk, decodes it if encrypted, and update access details.
        """
        result = await self.db.execute(
            select(FileMetadata).where(FileMetadata.id == file_id, FileMetadata.is_deleted == False)
        )
        metadata = result.scalars().first()
        if not metadata:
            raise FileNotFoundError("File metadata not found")

        absolute_path = os.path.join(self.base_dir, metadata.file_path)
        with open(absolute_path, "rb") as f:
            content = f.read()

        if metadata.is_encrypted and metadata.encryption_key_id:
            key = bytes.fromhex(metadata.encryption_key_id)
            content = self._decrypt(content, key)

        # Update access count & time
        metadata.access_count += 1
        metadata.last_accessed_at = datetime.now(timezone.utc)
        await self.db.flush()

        return content, metadata

    async def delete_file(self, file_id: UUID) -> None:
        """
        Remove file content from disk and soft-delete db entry.
        """
        result = await self.db.execute(
            select(FileMetadata).where(FileMetadata.id == file_id, FileMetadata.is_deleted == False)
        )
        metadata = result.scalars().first()
        if not metadata:
            return

        # Delete main file
        try:
            absolute_path = os.path.join(self.base_dir, metadata.file_path)
            if os.path.exists(absolute_path):
                os.remove(absolute_path)
        except Exception:
            pass

        # Delete thumbnails
        for thumb in [metadata.thumbnail_path, metadata.thumbnail_small_path, metadata.thumbnail_medium_path]:
            if thumb:
                try:
                    thumb_abs = os.path.join(self.base_dir, thumb)
                    if os.path.exists(thumb_abs):
                        os.remove(thumb_abs)
                except Exception:
                    pass

        metadata.soft_delete()
        await self.db.flush()
