import { createRequire } from "module";
const require = createRequire(import.meta.url);
const bcrypt = require("bcryptjs");
import fs from "fs";

// CHANGE THIS to your new password
const newPassword = "MyNewStrongPassword123";

async function resetJsonUser() {
  const users = JSON.parse(fs.readFileSync("./users.json"));
  const z = users.find(u => u.username === "z");
  if (!z) return console.log("User z not found!");

  const hashed = await bcrypt.hash(newPassword, 10);
  z.password = hashed;

  fs.writeFileSync("./users.json", JSON.stringify(users, null, 2));
  console.log("✅ Password reset for z. New password is:", newPassword);
}

resetJsonUser();
