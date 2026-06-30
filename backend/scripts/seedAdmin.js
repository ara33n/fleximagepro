const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { connectDatabase } = require('../config/db');
const AdminUser = require('../models/AdminUser');

async function main() {
  const username = 'fleximagepro';
  const password = 'Abcd1234';
  const passwordHash = await bcrypt.hash(password, 12);

  await connectDatabase();
  await AdminUser.updateOne(
    { username },
    {
      $set: {
        username,
        passwordHash,
        role: 'admin',
        active: true,
      },
    },
    { upsert: true },
  );

  console.log(`Admin user saved in MongoDB: ${username}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
