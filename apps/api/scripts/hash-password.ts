import { hashPassword } from "../src/http/sesion.js";

// Uso: npm run auth:hash -- "tu-contraseña"
// Imprime el valor para ADMIN_PASSWORD_HASH. No guarda nada.
const password = process.argv[2];

if (!password || password.length < 12) {
  console.error("Indica una contraseña de al menos 12 caracteres: npm run auth:hash -- \"...\"");
  process.exit(1);
}

hashPassword(password).then((hash) => {
  console.log(hash);
});
