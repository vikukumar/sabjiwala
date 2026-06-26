
new_code = r'''

# ===== Delivery KYC Endpoints =====

@router.get("/profile", response_model=APIResponse)
async def get_delivery_profile_alias(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Alias for /me endpoint used by KYC page."""
    boy = await _get_delivery_boy(current_user["user_id"], db)
    from app.models.delivery import DeliveryWallet
    vw_res = await db.execute(select(DeliveryWallet).where(DeliveryWallet.delivery_boy_id == boy.id))
    wallet = vw_res.scalars().first()
    data = {
        "id": str(boy.id), "user_id": str(boy.user_id),
        "full_name": getattr(boy, "full_name", ""),
        "phone": getattr(boy, "phone", ""),
        "kyc_status": boy.status.value,
        "vehicle_type": boy.vehicle_type, "vehicle_number": boy.vehicle_number,
        "is_online": boy.availability.value == "available",
        "average_rating": float(getattr(boy, "average_rating", 0) or 0),
        "total_deliveries": getattr(boy, "total_deliveries", 0),
        "wallet_balance": float(wallet.balance if wallet else 0),
        "cash_in_hand": float(wallet.cash_in_hand if wallet else 0),
    }
    return APIResponse(success=True, data=data)


@router.post("/kyc/upload", response_model=APIResponse)
async def upload_kyc_document(
    document_type: str,
    file: "UploadFile" = "File(...)",
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a KYC document for the delivery boy."""
    boy = await _get_delivery_boy(current_user["user_id"], db)
    try:
        from app.services.storage_service import StorageService
        storage = StorageService()
        contents = await file.read()
        file_path = await storage.save_file(
            f"kyc/delivery/{boy.id}/{document_type}_{file.filename}",
            contents, content_type=file.content_type
        )
        return APIResponse(success=True, data={"url": file_path, "document_type": document_type})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.post("/kyc/submit", response_model=APIResponse)
async def submit_kyc(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit KYC documents for review."""
    boy = await _get_delivery_boy(current_user["user_id"], db)
    boy.status = DeliveryBoyStatus.DOCUMENTS_SUBMITTED if hasattr(DeliveryBoyStatus, "DOCUMENTS_SUBMITTED") else boy.status
    await db.flush()
    await db.commit()
    return APIResponse(success=True, message="KYC documents submitted for review. Approval takes 24-48 hours.")
'''

with open(r'd:/Projects/sbjiwala/apps/backend/app/api/v1/endpoints/delivery.py', 'a', encoding='utf-8') as f:
    f.write(new_code)
print('Done!')
