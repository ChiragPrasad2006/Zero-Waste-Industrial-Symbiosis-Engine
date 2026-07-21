import argparse

from app.main import encrypt_email, get_db, hash_email, hash_password, now_utc


def main() -> None:
    parser = argparse.ArgumentParser(description='Create an admin user.')
    parser.add_argument('--email', required=True)
    parser.add_argument('--username', required=True)
    parser.add_argument('--password', required=True)
    args = parser.parse_args()

    db = get_db()
    email = args.email.strip().lower()
    username = args.username.strip()

    existing = db['users'].find_one({
        '$or': [
            {'username': username},
            {'emailHash': hash_email(email)},
        ],
    })
    if existing:
        print('Admin user already exists for that username or email.')
        return

    timestamp = now_utc()
    db['users'].insert_one({
        'username': username,
        'emailHash': hash_email(email),
        'emailEncrypted': encrypt_email(email),
        'password': hash_password(args.password),
        'role': 'admin',
        'superiorUntil': None,
        'sustainabilityScore': 10,
        'profileImage': '',
        'bio': '',
        'location': 'Peenya Industrial Area',
        'createdAt': timestamp,
        'updatedAt': timestamp,
    })
    print(f'Admin user created: {username}')


if __name__ == '__main__':
    main()
