import asyncio
import sys
import os
import json
import httpx
from redis.asyncio import from_url
from sqlalchemy import select, delete

# Add parent directory to path so we can import local modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.config import settings
from app.db.session import async_session_factory
from app.models.user import User, UserProfile, UserType, Role, UserRole
from app.models.vendor import Vendor, VendorWallet
from app.models.delivery import DeliveryBoy
from app.models.payment import Wallet, WalletType

API_URL = "http://localhost:8001/api/v1"

async def cleanup_test_data():
    """Clean up test users from the database and Redis before starting."""
    print("[*] Cleaning up existing test users from database...")
    test_emails = ["testvendor@sbjiwala.in", "testdelivery@sbjiwala.in", "testcustomer@sbjiwala.in", "testadmin@sbjiwala.in", "specialvendor@sbjiwala.in"]
    test_phones = ["+919000000001", "+919000000002", "+919000000003", "+919000000004", "+919000000005"]
    test_usernames = ["testvendor", "testdelivery", "testcustomer", "testadmin", "specialvendor"]

    async with async_session_factory() as session:
        # Find user IDs to clean up associated records
        stmt = select(User.id).where(
            (User.email.in_(test_emails)) |
            (User.phone.in_(test_phones)) |
            (User.username.in_(test_usernames))
        )
        res = await session.execute(stmt)
        user_ids = list(res.scalars().all())

        if user_ids:
            # Delete associated records manually to respect foreign key constraints
            await session.execute(delete(UserRole).where(UserRole.user_id.in_(user_ids)))
            await session.execute(delete(UserProfile).where(UserProfile.user_id.in_(user_ids)))
            
            # Vendor profiles
            vendor_stmt = select(Vendor.id).where(Vendor.user_id.in_(user_ids))
            vendor_res = await session.execute(vendor_stmt)
            vendor_ids = list(vendor_res.scalars().all())
            if vendor_ids:
                await session.execute(delete(VendorWallet).where(VendorWallet.vendor_id.in_(vendor_ids)))
                await session.execute(delete(Vendor).where(Vendor.id.in_(vendor_ids)))
            
            # Delivery profiles
            await session.execute(delete(DeliveryBoy).where(DeliveryBoy.user_id.in_(user_ids)))
            
            # Wallets
            await session.execute(delete(Wallet).where(Wallet.user_id.in_(user_ids)))
            
            # Users
            await session.execute(delete(User).where(User.id.in_(user_ids)))
            await session.commit()
            print(f"[+] Cleaned up {len(user_ids)} test user accounts and related profiles/wallets.")
        else:
            print("[+] No old test users found to clean up.")

    # Clean Redis keys
    print("[*] Cleaning up OTP keys from Redis...")
    redis = await from_url(settings.redis_url, decode_responses=True)
    for email in test_emails:
        keys = await redis.keys(f"otp:*:{email}")
        for k in keys:
            await redis.delete(k)
        keys_rate = await redis.keys(f"otp:rate:*:{email}")
        for k in keys_rate:
            await redis.delete(k)
    for phone in test_phones + ["9000000001", "9000000002", "9000000003", "9000000004", "9000000005"]:
        keys = await redis.keys(f"otp:*:{phone}")
        for k in keys:
            await redis.delete(k)
        keys_rate = await redis.keys(f"otp:rate:*:{phone}")
        for k in keys_rate:
            await redis.delete(k)
    await redis.close()
    print("[+] Redis cleanup completed.")


async def run_tests():
    await cleanup_test_data()

    async with httpx.AsyncClient() as client:
        # =====================================================================
        # 1. Dynamic Role Registration & Prioritized OTP Verification (Vendor)
        # =====================================================================
        print("\n=== Test 1: Register Vendor (Email + Phone, both provided) ===")
        # Both provided: check that OTP is routed to email
        vendor_payload = {
            "first_name": "Test",
            "last_name": "Vendor",
            "username": "testvendor",
            "email": "testvendor@sbjiwala.in",
            "phone": "9000000001",  # input format is 10 digit, backend formats to +91 phone
            "password": "Password123!",
            "role": "vendor"
        }
        res = await client.post(f"{API_URL}/auth/register", json=vendor_payload)
        assert res.status_code == 200, f"Registration failed: {res.text}"
        data = res.json()
        assert data["success"] is True
        print("[+] Vendor register request succeeded.")
        
        # Verify that verification target is email
        assert data["meta"]["verification_identifier"] == "testvendor@sbjiwala.in", "OTP should prioritize email when both are provided"
        print("[+] OTP prioritized email as expected.")

        # Read the debug OTP
        otp = data["meta"]["otp"]
        print(f"[+] Read Debug OTP: {otp}")

        # Let register commit
        await asyncio.sleep(0.5)

        # Verify registration OTP
        verify_res = await client.post(f"{API_URL}/auth/otp/verify", json={
            "identifier": "testvendor@sbjiwala.in",
            "otp": otp,
            "purpose": "register"
        })
        assert verify_res.status_code == 200, f"OTP verify failed: {verify_res.text}"
        print(f"[+] OTP verification response: {verify_res.json()}")
        print("[+] OTP verification succeeded.")

        # Let the background commit finish
        await asyncio.sleep(0.5)

        # Check DB State for Vendor
        async with async_session_factory() as session:
            stmt = select(User).where(User.username == "testvendor")
            user = (await session.execute(stmt)).scalars().first()
            assert user is not None
            assert user.is_verified is True
            assert user.is_active is True
            assert user.user_type == UserType.VENDOR
            print("[+] Verified DB User state: is_verified=True, is_active=True, user_type=VENDOR")

            # Check Vendor record
            vendor_stmt = select(Vendor).where(Vendor.user_id == user.id)
            vendor = (await session.execute(vendor_stmt)).scalars().first()
            assert vendor is not None
            print(f"[+] Created Vendor Business Name: {vendor.business_name}")

            # Check Vendor Wallet record
            wallet_stmt = select(VendorWallet).where(VendorWallet.vendor_id == vendor.id)
            wallet = (await session.execute(wallet_stmt)).scalars().first()
            assert wallet is not None
            print(f"[+] Created VendorWallet balance: {wallet.balance}")

        # =====================================================================
        # 2. Dynamic Role Registration (Delivery Boy, Email only)
        # =====================================================================
        print("\n=== Test 2: Register Delivery Boy (Email only) ===")
        delivery_payload = {
            "first_name": "Test",
            "last_name": "Delivery",
            "username": "testdelivery",
            "email": "testdelivery@sbjiwala.in",
            "password": "Password123!",
            "role": "delivery_boy"
        }
        res = await client.post(f"{API_URL}/auth/register", json=delivery_payload)
        assert res.status_code == 200, f"Registration failed: {res.text}"
        data = res.json()
        otp = data["meta"]["otp"]
        print(f"[+] Read Debug OTP: {otp}")

        # Let register commit
        await asyncio.sleep(0.5)

        verify_res = await client.post(f"{API_URL}/auth/otp/verify", json={
            "identifier": "testdelivery@sbjiwala.in",
            "otp": otp,
            "purpose": "register"
        })
        assert verify_res.status_code == 200, f"Delivery OTP verification failed: {verify_res.status_code} - {verify_res.text}"

        # Let the background commit finish
        await asyncio.sleep(0.5)

        # Check DB State for Delivery Boy
        async with async_session_factory() as session:
            stmt = select(User).where(User.username == "testdelivery")
            user = (await session.execute(stmt)).scalars().first()
            assert user is not None
            assert user.user_type == UserType.DELIVERY_BOY

            # Check Delivery Boy record
            dboy_stmt = select(DeliveryBoy).where(DeliveryBoy.user_id == user.id)
            dboy = (await session.execute(dboy_stmt)).scalars().first()
            assert dboy is not None

            # Check Delivery Wallet
            wallet_stmt = select(Wallet).where(Wallet.user_id == user.id)
            wallet = (await session.execute(wallet_stmt)).scalars().first()
            assert wallet is not None
            assert wallet.wallet_type == WalletType.DELIVERY
            print("[+] Verified DeliveryBoy wallet created with type DELIVERY.")

        # =====================================================================
        # 3. Dynamic Role Registration (Customer, Phone only)
        # =====================================================================
        print("\n=== Test 3: Register Customer (Phone only) ===")
        customer_payload = {
            "first_name": "Test",
            "last_name": "Customer",
            "username": "testcustomer",
            "phone": "9000000003",
            "password": "Password123!",
            "role": "customer"
        }
        res = await client.post(f"{API_URL}/auth/register", json=customer_payload)
        assert res.status_code == 200, f"Registration failed: {res.text}"
        data = res.json()
        otp = data["meta"]["otp"]
        print(f"[+] Read Debug OTP: {otp}")

        # Let register commit
        await asyncio.sleep(0.5)

        verify_res = await client.post(f"{API_URL}/auth/otp/verify", json={
            "identifier": "+919000000003",
            "otp": otp,
            "purpose": "register"
        })
        assert verify_res.status_code == 200, f"Customer OTP verification failed: {verify_res.status_code} - {verify_res.text}"

        # Let the background commit finish
        await asyncio.sleep(0.5)

        # Check DB State for Customer
        async with async_session_factory() as session:
            stmt = select(User).where(User.username == "testcustomer")
            user = (await session.execute(stmt)).scalars().first()
            assert user is not None
            assert user.user_type == UserType.CUSTOMER

            # Check Customer Wallet
            wallet_stmt = select(Wallet).where(Wallet.user_id == user.id)
            wallet = (await session.execute(wallet_stmt)).scalars().first()
            assert wallet is not None
            assert wallet.wallet_type == WalletType.CUSTOMER
            print("[+] Verified Customer wallet created with type CUSTOMER.")

        # =====================================================================
        # 4. Login with Password (different identifiers)
        # =====================================================================
        print("\n=== Test 4: Password Login using Username, Phone, and Email ===")
        # Username
        login_res1 = await client.post(f"{API_URL}/auth/login", json={
            "identifier": "testvendor",
            "password": "Password123!"
        })
        assert login_res1.status_code == 200
        assert "access_token" in login_res1.json()["meta"]
        print("[+] Logged in successfully using username: testvendor")

        # Email
        login_res2 = await client.post(f"{API_URL}/auth/login", json={
            "identifier": "testvendor@sbjiwala.in",
            "password": "Password123!"
        })
        assert login_res2.status_code == 200
        print("[+] Logged in successfully using email: testvendor@sbjiwala.in")

        # Phone
        login_res3 = await client.post(f"{API_URL}/auth/login", json={
            "identifier": "9000000001",
            "password": "Password123!"
        })
        assert login_res3.status_code == 200
        print("[+] Logged in successfully using phone: 9000000001")

        # =====================================================================
        # 5. OTP Login Flow
        # =====================================================================
        print("\n=== Test 5: Passwordless OTP Login (prioritized channel verify) ===")
        # Send OTP for testvendor (who has both email and phone). Should prioritize email.
        send_otp_res = await client.post(f"{API_URL}/auth/otp/send", json={
            "identifier": "testvendor",
            "purpose": "login"
        })
        assert send_otp_res.status_code == 200
        otp_data = send_otp_res.json()
        assert "otp" in otp_data["meta"]
        assert "@sbjiwala.in" in otp_data["message"], "OTP should be sent to email since both exist"
        print("[+] OTP login request correctly routed to email.")

        otp = otp_data["meta"]["otp"]
        print(f"[+] Read OTP: {otp}")

        # Verify OTP to log in
        verify_otp_res = await client.post(f"{API_URL}/auth/otp/verify", json={
            "identifier": "testvendor",
            "otp": otp,
            "purpose": "login"
        })
        assert verify_otp_res.status_code == 200, f"OTP verify failed: {verify_otp_res.status_code} - {verify_otp_res.text}"
        assert "access_token" in verify_otp_res.json()["meta"]
        print("[+] OTP login verification completed successfully.")

        # =====================================================================
        # 6. Magic Link Login Flow
        # =====================================================================
        print("\n=== Test 6: Magic Link Request and Complete Login ===")
        magic_req = await client.post(f"{API_URL}/auth/magic-link/request", json={
            "identifier": "testcustomer",
            "role": "customer"
        })
        assert magic_req.status_code == 200
        print("[+] Magic link request sent successfully.")

        # Since it goes to Redis under "magic_link:<token>", let's query Redis to fetch it
        redis = await from_url(settings.redis_url, decode_responses=True)
        keys = await redis.keys("magic_link:*")
        assert len(keys) > 0, "No magic link token found in Redis"
        magic_token = keys[0].split(":")[1]
        print(f"[+] Retrieved Magic Token from Redis: {magic_token}")
        await redis.close()

        # Complete magic link verification
        magic_login_res = await client.get(f"{API_URL}/auth/magic-link/verify?token={magic_token}")
        assert magic_login_res.status_code == 200
        assert "access_token" in magic_login_res.json()["meta"]
        print("[+] Magic link verification completed, logged in successfully.")

        # =====================================================================
        # 7. Password Reset / Recovery Flow
        # =====================================================================
        print("\n=== Test 7: Password Reset / Recovery Flow ===")
        # Request reset OTP
        reset_req = await client.post(f"{API_URL}/auth/password/reset/request", json={
            "identifier": "testcustomer"
        })
        assert reset_req.status_code == 200
        reset_otp_data = reset_req.json()
        assert "otp" in reset_otp_data["meta"]
        otp = reset_otp_data["meta"]["otp"]
        print(f"[+] Read Reset OTP: {otp}")

        # Verify reset OTP to get reset token
        reset_verify = await client.post(f"{API_URL}/auth/password/reset/verify", json={
            "identifier": "testcustomer",
            "otp": otp
        })
        assert reset_verify.status_code == 200
        reset_token = reset_verify.json()["meta"]["reset_token"]
        print(f"[+] Retrieved Reset Token: {reset_token}")

        # Confirm new password
        reset_confirm = await client.post(f"{API_URL}/auth/password/reset/confirm", json={
            "token": reset_token,
            "new_password": "NewPassword123!"
        })
        assert reset_confirm.status_code == 200
        print("[+] Password updated successfully.")

        # Let password reset commit
        await asyncio.sleep(0.5)

        # Validate we can log in with the new password
        new_login = await client.post(f"{API_URL}/auth/login", json={
            "identifier": "testcustomer",
            "password": "NewPassword123!"
        })
        assert new_login.status_code == 200
        print("[+] Logged in successfully using the new password!")

        # =====================================================================
        # 8. Admin Oversight and Role-Specific SignUp Validation
        # =====================================================================
        print("\n=== Test 8: Admin Role-Specific Signup & Control APIs ===")
        # 8.1 Register Admin to get token
        admin_payload = {
            "first_name": "System",
            "last_name": "Admin",
            "username": "testadmin",
            "email": "testadmin@sbjiwala.in",
            "phone": "9000000004",
            "password": "Password123!",
            "role": "admin"
        }
        admin_reg = await client.post(f"{API_URL}/auth/register", json=admin_payload)
        assert admin_reg.status_code == 200
        admin_otp = admin_reg.json()["meta"]["otp"]
        
        await asyncio.sleep(0.5)
        
        admin_verify = await client.post(f"{API_URL}/auth/otp/verify", json={
            "identifier": "testadmin@sbjiwala.in",
            "otp": admin_otp,
            "purpose": "register"
        })
        assert admin_verify.status_code == 200
        admin_token = admin_verify.json()["meta"]["access_token"]
        headers = {"Authorization": f"Bearer {admin_token}"}
        print("[+] Admin registered and token acquired.")

        # 8.2 Clean and register a new vendor with role-specific fields
        vendor_details_payload = {
            "first_name": "Special",
            "last_name": "Vendor",
            "username": "specialvendor",
            "email": "specialvendor@sbjiwala.in",
            "phone": "9000000005",
            "password": "Password123!",
            "role": "vendor",
            "business_name": "Fresh Organic Mart LLC",
            "business_type": "company",
            "description": "Premium fresh green organic produce provider",
            "gst_number": "22AAAAA1111A1Z1",
            "pan_number": "ABCDE1234F",
            "fssai_number": "12345678901234"
        }
        # Clean up this user from previous test run if any
        async with async_session_factory() as session:
            stmt = select(User.id).where(User.username == "specialvendor")
            res = await session.execute(stmt)
            sv_uid = res.scalar()
            if sv_uid:
                await session.execute(delete(UserRole).where(UserRole.user_id == sv_uid))
                await session.execute(delete(UserProfile).where(UserProfile.user_id == sv_uid))
                # Delete vendor details
                vendor_stmt = select(Vendor.id).where(Vendor.user_id == sv_uid)
                vendor_res = await session.execute(vendor_stmt)
                v_ids = list(vendor_res.scalars().all())
                if v_ids:
                    from app.models.vendor import VendorStore
                    await session.execute(delete(VendorStore).where(VendorStore.vendor_id.in_(v_ids)))
                    await session.execute(delete(VendorWallet).where(VendorWallet.vendor_id.in_(v_ids)))
                    await session.execute(delete(Vendor).where(Vendor.id.in_(v_ids)))
                await session.execute(delete(Wallet).where(Wallet.user_id == sv_uid))
                await session.execute(delete(User).where(User.id == sv_uid))
                await session.commit()

        v_reg = await client.post(f"{API_URL}/auth/register", json=vendor_details_payload)
        assert v_reg.status_code == 200
        v_otp = v_reg.json()["meta"]["otp"]
        
        await asyncio.sleep(0.5)
        
        await client.post(f"{API_URL}/auth/otp/verify", json={
            "identifier": "specialvendor@sbjiwala.in",
            "otp": v_otp,
            "purpose": "register"
        })
        print("[+] Vendor with custom business details registered.")

        # Let DB update commit
        await asyncio.sleep(0.5)

        # 8.3 Verify Vendor store and wallet was initialized
        async with async_session_factory() as session:
            from app.models.vendor import VendorStore
            stmt = select(User).where(User.username == "specialvendor")
            v_user = (await session.execute(stmt)).scalars().first()
            assert v_user is not None
            
            vendor_stmt = select(Vendor).where(Vendor.user_id == v_user.id)
            vendor = (await session.execute(vendor_stmt)).scalars().first()
            assert vendor is not None
            assert vendor.business_name == "Fresh Organic Mart LLC"
            assert vendor.gst_number == "22AAAAA1111A1Z1"
            assert vendor.pan_number == "ABCDE1234F"
            assert vendor.fssai_number == "12345678901234"
            assert vendor.description == "Premium fresh green organic produce provider"
            
            store_stmt = select(VendorStore).where(VendorStore.vendor_id == vendor.id)
            store = (await session.execute(store_stmt)).scalars().first()
            assert store is not None
            assert store.store_name == "Fresh Organic Mart LLC"
            print("[+] VendorStore correctly initialized with matching business name.")

        # 8.4 Test admin users list
        users_list_res = await client.get(f"{API_URL}/admin/users", headers=headers)
        assert users_list_res.status_code == 200
        users_list = users_list_res.json()["data"]
        assert len(users_list) > 0
        special_user_entry = next((u for u in users_list if u["username"] == "specialvendor"), None)
        assert special_user_entry is not None
        print("[+] Admin /admin/users endpoint verified.")

        # 8.5 Test block/unblock user
        block_res = await client.patch(f"{API_URL}/admin/users/{special_user_entry['id']}/status", json={"is_active": False}, headers=headers)
        assert block_res.status_code == 200
        async with async_session_factory() as session:
            stmt = select(User.is_active).where(User.username == "specialvendor")
            is_active = (await session.execute(stmt)).scalar()
            assert is_active is False
            print("[+] Block user status modification verified.")

        # 8.6 Test update vendor settings (commission & delivery rule configs)
        vendors_list_res = await client.get(f"{API_URL}/admin/vendors", headers=headers)
        assert vendors_list_res.status_code == 200
        vendors_list = vendors_list_res.json()["data"]
        special_vendor_entry = next((v for v in vendors_list if v["business_name"] == "Fresh Organic Mart LLC"), None)
        assert special_vendor_entry is not None

        update_vendor_res = await client.patch(
            f"{API_URL}/admin/vendors/{special_vendor_entry['id']}/commission",
            json={
                "commission_rate": 0.075,
                "business_name": "Fresh Organic Mart Refined",
                "min_order_amount": 250.0,
                "base_delivery_charge": 45.0,
                "per_km_charge": 6.5
            },
            headers=headers
        )
        assert update_vendor_res.status_code == 200
        
        await asyncio.sleep(0.5)
        
        async with async_session_factory() as session:
            from app.models.vendor import VendorDeliveryRule
            stmt = select(Vendor).where(Vendor.id == special_vendor_entry["id"])
            v_ref = (await session.execute(stmt)).scalars().first()
            assert v_ref.commission_rate == 0.075
            assert v_ref.business_name == "Fresh Organic Mart Refined"
            
            rule_stmt = select(VendorDeliveryRule).where(VendorDeliveryRule.vendor_id == special_vendor_entry["id"])
            rule_ref = (await session.execute(rule_stmt)).scalars().first()
            assert float(rule_ref.min_order_amount) == 250.0
            assert float(rule_ref.base_delivery_charge) == 45.0
            assert float(rule_ref.per_km_charge) == 6.5
            print("[+] Custom vendor settings and delivery rules updates verified.")

        # =====================================================================
        # 9. Multi-Role Append & Switch Login Verification
        # =====================================================================
        print("\n=== Test 9: Multi-Role Append Registration & Switch Login ===")
        # Clear Redis rate limits for specialvendor email to prevent 60-second limit error
        redis = await from_url(settings.redis_url, decode_responses=True)
        keys_rate = await redis.keys("otp:rate:*:specialvendor@sbjiwala.in")
        for k in keys_rate:
            await redis.delete(k)
        await redis.close()

        # Register the existing 'specialvendor' user as a delivery boy
        append_payload = {
            "first_name": "Special",
            "last_name": "Vendor",
            "username": "specialvendor",
            "email": "specialvendor@sbjiwala.in",
            "phone": "9000000005",
            "password": "Password123!",
            "role": "delivery_boy",
            "vehicle_type": "scooter",
            "vehicle_number": "MH12XY9999",
            "license_number": "DL-99999999999"
        }
        append_res = await client.post(f"{API_URL}/auth/register", json=append_payload)
        assert append_res.status_code == 200, f"Append registration failed: {append_res.text}"
        append_data = append_res.json()
        assert append_data["success"] is True
        print("[+] Append registration request succeeded (Vendor adding Delivery Boy role).")
        
        # Verify message mentions adding role
        assert "delivery_boy" in append_data["message"]
        
        # Verify registration OTP
        append_otp = append_data["meta"]["otp"]
        verify_append_res = await client.post(f"{API_URL}/auth/otp/verify", json={
            "identifier": "specialvendor@sbjiwala.in",
            "otp": append_otp,
            "purpose": "register"
        })
        assert verify_append_res.status_code == 200, f"Verify append OTP failed: {verify_append_res.text}"
        print("[+] OTP verified for append role.")
        
        # Let DB commit
        await asyncio.sleep(0.5)
        
        # Check DB State for User Roles and Delivery Boy Profile
        async with async_session_factory() as session:
            stmt = select(User).where(User.username == "specialvendor")
            sv_user = (await session.execute(stmt)).scalars().first()
            assert sv_user is not None
            
            # User roles check: must have BOTH roles
            from app.models.user import UserRole, Role
            roles_stmt = select(Role.name).join(UserRole).where(UserRole.user_id == sv_user.id)
            user_role_names = list((await session.execute(roles_stmt)).scalars().all())
            assert "vendor" in user_role_names, "Should keep existing vendor role"
            assert "delivery_boy" in user_role_names, "Should append delivery_boy role"
            print(f"[+] Verified user holds multiple roles: {user_role_names}")
            
            # Check Delivery Boy record
            dboy_stmt = select(DeliveryBoy).where(DeliveryBoy.user_id == sv_user.id)
            dboy = (await session.execute(dboy_stmt)).scalars().first()
            assert dboy is not None
            assert dboy.vehicle_type == "scooter"
            assert dboy.vehicle_number == "MH12XY9999"
            assert dboy.license_number == "DL-99999999999"
            print("[+] Verified DeliveryBoy profile created with vehicle details.")
            
            # Check Delivery Wallet
            wallet_stmt = select(Wallet).where(Wallet.user_id == sv_user.id, Wallet.wallet_type == WalletType.DELIVERY)
            wallet = (await session.execute(wallet_stmt)).scalars().first()
            assert wallet is not None
            print("[+] Verified Delivery Wallet initialized.")

        # Test Switch Logins with Role Claim Verification
        # 9.1 Login as Vendor
        vendor_login_res = await client.post(f"{API_URL}/auth/login", json={
            "identifier": "specialvendor",
            "password": "Password123!",
            "role": "vendor"
        })
        assert vendor_login_res.status_code == 200
        vendor_login_data = vendor_login_res.json()
        assert vendor_login_data["data"]["active_role"] == "vendor"
        
        # Verify JWT role claim for Vendor
        v_token = vendor_login_data["meta"]["access_token"]
        import jwt
        decoded_v = jwt.decode(v_token, options={"verify_signature": False})
        assert decoded_v["user_type"] == "vendor"
        print("[+] Logged in as Vendor. Verified JWT user_type claim is 'vendor'.")
        
        # 9.2 Login as Delivery Boy
        delivery_login_res = await client.post(f"{API_URL}/auth/login", json={
            "identifier": "specialvendor",
            "password": "Password123!",
            "role": "delivery_boy"
        })
        assert delivery_login_res.status_code == 200
        delivery_login_data = delivery_login_res.json()
        assert delivery_login_data["data"]["active_role"] == "delivery_boy"
        
        # Verify JWT role claim for Delivery Boy
        d_token = delivery_login_data["meta"]["access_token"]
        decoded_d = jwt.decode(d_token, options={"verify_signature": False})
        assert decoded_d["user_type"] == "delivery_boy"
        print("[+] Logged in as Delivery Boy. Verified JWT user_type claim is 'delivery_boy'.")

        # 9.3 Login as Customer (which they don't have)
        cust_login_res = await client.post(f"{API_URL}/auth/login", json={
            "identifier": "specialvendor",
            "password": "Password123!",
            "role": "customer"
        })
        assert cust_login_res.status_code == 400, "Should reject login for unassigned role"
        print("[+] Rejected login with unassigned role (customer) as expected.")

    print("\n[SUCCESS] All authentication test suites passed!")


if __name__ == "__main__":
    asyncio.run(run_tests())
