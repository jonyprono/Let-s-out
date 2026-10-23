#!/usr/bin/env python3
import os
import sys
import time
import json
import base64
import subprocess
import requests
import jwt

def log(msg):
    print(f"[setup-ios-signing] {msg}", flush=True)

def main():
    key_id = os.environ.get("APPSTORE_KEY_ID")
    issuer_id = os.environ.get("APPSTORE_ISSUER_ID")
    team_id = os.environ.get("TEAM_ID", "GWZQYSN37A")
    bundle_id = os.environ.get("BUNDLE_ID", "com.letsout.app")
    keychain_path = os.environ.get("KEYCHAIN_PATH")
    keychain_pass = os.environ.get("KEYCHAIN_PASS")

    if not key_id or not issuer_id:
        log("ERROR: Missing APPSTORE_KEY_ID or APPSTORE_ISSUER_ID")
        sys.exit(1)

    key_path = os.path.expanduser(f"~/.appstoreconnect/private_keys/AuthKey_{key_id}.p8")
    if not os.path.exists(key_path):
        # Check alternative location
        alt_key_path = os.path.expanduser(f"~/.private_keys/AuthKey_{key_id}.p8")
        if os.path.exists(alt_key_path):
            key_path = alt_key_path
        else:
            log(f"ERROR: Key file not found at {key_path}")
            sys.exit(1)

    with open(key_path, "r") as f:
        private_key = f.read()

    # 1. Generate JWT
    log("Generating JWT for App Store Connect API...")
    now = int(time.time())
    payload = {
        "iss": issuer_id,
        "iat": now,
        "exp": now + 1200,  # 20 minutes
        "aud": "appstoreconnect-v1"
    }
    headers = {
        "kid": key_id,
        "typ": "JWT",
        "alg": "ES256"
    }
    token = jwt.encode(payload, private_key, algorithm="ES256", headers=headers)
    if isinstance(token, bytes):
        token = token.decode("utf-8")

    api_headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    # 2. Check and clean up existing IOS_DISTRIBUTION certificates
    log("Checking existing Distribution certificates via App Store Connect API...")
    certs_resp = requests.get(
        "https://api.appstoreconnect.apple.com/v1/certificates?filter[certificateType]=IOS_DISTRIBUTION",
        headers=api_headers
    )
    if certs_resp.status_code != 200:
        log(f"ERROR querying certificates: {certs_resp.status_code} - {certs_resp.text}")
        sys.exit(1)

    existing_certs = certs_resp.json().get("data", [])
    log(f"Found {len(existing_certs)} existing iOS Distribution certificates.")

    # Apple limit is usually 2 or 3. If >= 2, delete the oldest
    if len(existing_certs) >= 2:
        oldest_cert = existing_certs[0]
        oldest_id = oldest_cert["id"]
        log(f"Account has {len(existing_certs)} Distribution certs. Deleting oldest ({oldest_id}) to free up slot...")
        del_resp = requests.delete(
            f"https://api.appstoreconnect.apple.com/v1/certificates/{oldest_id}",
            headers=api_headers
        )
        if del_resp.status_code in (200, 204):
            log(f"Successfully deleted certificate {oldest_id}")
        else:
            log(f"Warning: could not delete {oldest_id}: {del_resp.text}")

    # 3. Generate RSA Key & CSR
    log("Generating 2048-bit RSA key and CSR...")
    dist_key_path = "/tmp/dist_key.pem"
    dist_csr_path = "/tmp/dist_request.csr"

    subprocess.run([
        "openssl", "genrsa", "-out", dist_key_path, "2048"
    ], check=True)

    subprocess.run([
        "openssl", "req", "-new", "-key", dist_key_path,
        "-subj", f"/CN=iOS Distribution/OU={issuer_id}/O={team_id}/C=US",
        "-out", dist_csr_path
    ], check=True)

    with open(dist_csr_path, "r") as f:
        csr_content = f.read()

    # 4. Request new iOS Distribution Certificate from Apple
    log("Requesting new iOS Distribution certificate from App Store Connect API...")
    create_cert_payload = {
        "data": {
            "type": "certificates",
            "attributes": {
                "certificateType": "IOS_DISTRIBUTION",
                "csrContent": csr_content
            }
        }
    }
    cert_post_resp = requests.post(
        "https://api.appstoreconnect.apple.com/v1/certificates",
        headers=api_headers,
        json=create_cert_payload
    )

    if cert_post_resp.status_code not in (200, 201):
        log(f"ERROR creating certificate: {cert_post_resp.status_code} - {cert_post_resp.text}")
        sys.exit(1)

    cert_json = cert_post_resp.json()
    cert_id = cert_json["data"]["id"]
    cert_b64 = cert_json["data"]["attributes"]["certificateContent"]
    cert_der = base64.b64decode(cert_b64)

    with open("/tmp/distribution.cer", "wb") as f:
        f.write(cert_der)
    log(f"✅ Created Apple Distribution Certificate ID: {cert_id}")

    # 5. Convert to PEM and package into PKCS#12 (.p12)
    log("Packaging certificate and private key into PKCS#12...")
    subprocess.run([
        "openssl", "x509", "-inform", "DER",
        "-in", "/tmp/distribution.cer",
        "-out", "/tmp/distribution.pem"
    ], check=True)

    p12_pass = "ci_p12_pass"
    p12_path = "/tmp/distribution.p12"
    subprocess.run([
        "openssl", "pkcs12", "-export",
        "-inkey", dist_key_path,
        "-in", "/tmp/distribution.pem",
        "-out", p12_path,
        "-passout", f"pass:{p12_pass}"
    ], check=True)

    # 6. Import certificate and WWDR CA into keychain
    log(f"Importing certificate into keychain at {keychain_path}...")
    ca_url = "https://www.apple.com/certificateauthority/AppleWWDRCAG3.cer"
    try:
        ca_data = requests.get(ca_url, timeout=10).content
        with open("/tmp/AppleWWDRCAG3.cer", "wb") as f:
            f.write(ca_data)
        subprocess.run(["security", "import", "/tmp/AppleWWDRCAG3.cer", "-k", keychain_path], check=False)
    except Exception as e:
        log(f"Note: Could not download Apple WWDR CA: {e}")

    subprocess.run([
        "security", "import", p12_path,
        "-k", keychain_path,
        "-P", p12_pass,
        "-T", "/usr/bin/codesign",
        "-T", "/usr/bin/xcodebuild"
    ], check=True)

    subprocess.run([
        "security", "set-key-partition-list",
        "-S", "apple-tool:,apple:,codesign:",
        "-s", "-k", keychain_pass, keychain_path
    ], check=True)

    # Verify code signing identity in keychain
    verify_proc = subprocess.run([
        "security", "find-identity", "-v", "-p", "codesigning", keychain_path
    ], capture_output=True, text=True)
    log("Keychain code signing identities:")
    log(verify_proc.stdout)

    # 7. Find Bundle ID resource
    log(f"Looking up Bundle ID resource for identifier '{bundle_id}'...")
    b_resp = requests.get(
        f"https://api.appstoreconnect.apple.com/v1/bundleIds?filter[identifier]={bundle_id}",
        headers=api_headers
    )
    bundle_resource_id = None
    if b_resp.status_code == 200 and b_resp.json().get("data"):
        bundle_resource_id = b_resp.json()["data"][0]["id"]
    else:
        # Fallback: query all bundle IDs
        all_b_resp = requests.get("https://api.appstoreconnect.apple.com/v1/bundleIds", headers=api_headers)
        if all_b_resp.status_code == 200:
            for item in all_b_resp.json().get("data", []):
                if item.get("attributes", {}).get("identifier") == bundle_id:
                    bundle_resource_id = item["id"]
                    break

    if not bundle_resource_id:
        log(f"ERROR: Could not find Bundle ID for '{bundle_id}' on Apple Developer account.")
        sys.exit(1)

    log(f"Found Bundle ID resource ID: {bundle_resource_id}")

    # 8. Manage Provisioning Profile for App Store Distribution
    profile_name = "LetsOut CI AppStore Profile"
    log(f"Checking existing profiles for name '{profile_name}' or type IOS_APP_STORE...")
    profiles_resp = requests.get(
        "https://api.appstoreconnect.apple.com/v1/profiles?filter[profileType]=IOS_APP_STORE",
        headers=api_headers
    )
    if profiles_resp.status_code == 200:
        for prof in profiles_resp.json().get("data", []):
            prof_name = prof.get("attributes", {}).get("name", "")
            if prof_name == profile_name:
                log(f"Deleting previous profile '{prof_name}' (ID: {prof['id']})...")
                requests.delete(f"https://api.appstoreconnect.apple.com/v1/profiles/{prof['id']}", headers=api_headers)

    log(f"Creating new App Store Provisioning Profile linked to certificate {cert_id}...")
    create_profile_payload = {
        "data": {
            "type": "profiles",
            "attributes": {
                "name": profile_name,
                "profileType": "IOS_APP_STORE"
            },
            "relationships": {
                "bundleId": {
                    "data": {
                        "type": "bundleIds",
                        "id": bundle_resource_id
                    }
                },
                "certificates": {
                    "data": [
                        {
                            "type": "certificates",
                            "id": cert_id
                        }
                    ]
                }
            }
        }
    }

    create_prof_resp = requests.post(
        "https://api.appstoreconnect.apple.com/v1/profiles",
        headers=api_headers,
        json=create_profile_payload
    )

    if create_prof_resp.status_code not in (200, 201):
        log(f"ERROR creating profile: {create_prof_resp.status_code} - {create_prof_resp.text}")
        sys.exit(1)

    prof_data = create_prof_resp.json()["data"]
    profile_uuid = prof_data["attributes"]["uuid"]
    profile_b64 = prof_data["attributes"]["profileContent"]
    profile_bytes = base64.b64decode(profile_b64)

    # 9. Install profile into ~/Library/MobileDevice/Provisioning Profiles/
    prov_dir = os.path.expanduser("~/Library/MobileDevice/Provisioning Profiles")
    os.makedirs(prov_dir, exist_ok=True)
    prov_file_path = os.path.join(prov_dir, f"{profile_uuid}.mobileprovision")
    with open(prov_file_path, "wb") as f:
        f.write(profile_bytes)
    log(f"✅ Provisioning profile installed at: {prov_file_path}")
    log(f"Profile UUID: {profile_uuid}")
    log(f"Profile Name: {profile_name}")

    # 10. Update ExportOptions.plist
    export_plist_path = "apps/web/ios/App/ExportOptions.plist"
    plist_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store</string>
    <key>teamID</key>
    <string>{team_id}</string>
    <key>signingStyle</key>
    <string>manual</string>
    <key>signingCertificate</key>
    <string>Apple Distribution</string>
    <key>provisioningProfiles</key>
    <dict>
        <key>{bundle_id}</key>
        <string>{profile_name}</string>
    </dict>
    <key>uploadSymbols</key>
    <true/>
    <key>manageAppVersionAndBuildNumber</key>
    <true/>
</dict>
</plist>
"""
    with open(export_plist_path, "w", encoding="utf-8") as f:
        f.write(plist_content)
    log(f"Updated {export_plist_path} for manual App Store distribution signing.")

    # 11. Export environment variables to GITHUB_ENV if in CI
    github_env = os.environ.get("GITHUB_ENV")
    if github_env:
        with open(github_env, "a") as f:
            f.write(f"PROFILE_UUID={profile_uuid}\n")
            f.write(f"PROFILE_NAME={profile_name}\n")

    # Clean up sensitive temporary key and csr files
    for temp_f in [dist_key_path, dist_csr_path, "/tmp/distribution.cer", "/tmp/distribution.pem", p12_path]:
        if os.path.exists(temp_f):
            try:
                os.remove(temp_f)
            except Exception:
                pass

    log("✅ iOS Code Signing setup completed successfully!")

if __name__ == "__main__":
    main()
