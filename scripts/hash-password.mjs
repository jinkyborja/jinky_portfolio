import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline';

const prompt = createInterface({ input: process.stdin, output: process.stderr });
prompt.question('Owner analytics password: ', (password) => {
  prompt.close();
  if (password.length < 12 || password.length > 1024) {
    console.error('Enter a password between 12 and 1024 characters.');
    process.exitCode = 1;
    return;
  }

  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, 210000, 32, 'sha256');
  console.log(`ANALYTICS_OWNER_PASSWORD_HASH=${salt.toString('base64url')}:${hash.toString('base64url')}`);
});
