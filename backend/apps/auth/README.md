## JWT configuration

Run this command for generate JWT access token private and public keys:

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out jwt-access.key && 
openssl rsa -in jwt-access.key -pubout -out jwt-access.key.pub && 
echo "JWT_ACCESS_PRIVATE_KEY_BASE64=$(base64 -i jwt-access.key | tr -d '\n')" && 
echo "JWT_ACCESS_PUBLIC_KEY_BASE64=$(base64 -i jwt-access.key.pub | tr -d '\n')"
```
