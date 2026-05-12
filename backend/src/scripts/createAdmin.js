import 'dotenv/config';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import { encryptEmail, hashEmail } from '../utils/crypto.js';

const parseArgs = () => {
  const args = process.argv.slice(2);
  const getArg = (flag) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : '';
  };

  return {
    email: getArg('--email'),
    username: getArg('--username'),
    password: getArg('--password')
  };
};

const run = async () => {
  const { email, username, password } = parseArgs();

  if (!email || !username || !password) {
    console.error('Usage: npm run create-admin -- --email admin@example.com --username admin --password StrongPass123!');
    process.exit(1);
  }

  await connectDB();

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await User.findOne({
    $or: [{ username: username.trim() }, { emailHash: hashEmail(normalizedEmail) }]
  });

  if (existing) {
    console.error('Admin user already exists with that username or email.');
    process.exit(1);
  }

  const admin = await User.create({
    username: username.trim(),
    emailHash: hashEmail(normalizedEmail),
    emailEncrypted: encryptEmail(normalizedEmail),
    password,
    role: 'admin',
    superiorUntil: new Date('2099-12-31T00:00:00.000Z'),
    sustainabilityScore: 100
  });

  console.log(`Admin created: ${admin.username}`);
  process.exit(0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

