import os
import hashlib
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from jose import JWTError, jwt
from pydantic import BaseModel, Field
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError
from bson import ObjectId
import bcrypt

BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_ROOT.parent

load_dotenv(BACKEND_ROOT / '.env')

MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/zero-waste-engine')
DB_NAME = os.getenv('DB_NAME', 'zero-waste-engine')
JWT_SECRET = os.getenv('JWT_SECRET', 'change-me')
EMAIL_SECRET = os.getenv('EMAIL_SECRET', '32-char-secret-key-change-me!!')
CLIENT_URLS = [item.strip() for item in os.getenv('CLIENT_URL', 'http://localhost:5173,http://127.0.0.1:5173').split(',') if item.strip()]
PORT = int(os.getenv('PORT', '5000'))
IS_PRODUCTION = os.getenv('NODE_ENV') == 'production'

app = FastAPI(title='Zero Waste Backend')

app.add_middleware(
    CORSMiddleware,
    allow_origins=CLIENT_URLS + ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://127.0.0.1:5174', 'http://localhost:3000', 'http://127.0.0.1:3000'],
    allow_origin_regex='.*' if IS_PRODUCTION else None,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

client: Optional[MongoClient] = None
_db: Optional[Any] = None


def connect_db() -> None:
    global client, _db
    if _db is not None:
        return
    try:
        client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000, tz_aware=True, tzinfo=timezone.utc)
        client.admin.command('ping')
        _db = client[DB_NAME]
        ensure_indexes()
    except Exception as exc:  # pragma: no cover - runtime dependency handling
        _db = None
        client = None
        raise RuntimeError('Database unavailable') from exc


def get_db() -> Any:
    global _db
    if _db is None:
        try:
            connect_db()
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail='Database unavailable') from exc
    return _db


def ensure_indexes() -> None:
    if _db is None:
        return
    _db['users'].create_index('emailHash', unique=True)
    _db['users'].create_index('username', unique=True)
    _db['posts'].create_index([('status', 1), ('category', 1), ('seller', 1), ('createdAt', -1)])
    _db['posts'].create_index([('title', 'text'), ('description', 'text'), ('category', 'text'), ('purpose', 'text')])
    _db['conversations'].create_index([('participants', 1), ('post', 1)])
    _db['messages'].create_index('conversation')
    _db['upgrade_requests'].create_index([('user', 1), ('status', 1)])
    _db['category_requests'].create_index([('name', 1), ('status', 1)])


DEFAULT_CATEGORIES = ['Excess Heat', 'Steam Waste', 'Scrap Aluminum', 'Chemical Sludge', 'Packaging Waste', 'Fly Ash']


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def as_aware_utc(value: Any) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace('Z', '+00:00'))
        except ValueError:
            return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
    return None


def parse_object_id(value: str, label: str = 'id') -> ObjectId:
    if not ObjectId.is_valid(value):
        raise HTTPException(status_code=400, detail=f'Invalid {label}')
    return ObjectId(value)


def normalize_category_name(value: str = '') -> str:
    cleaned = ' '.join(str(value or '').split())
    if not cleaned:
        return ''
    return re.sub(r'\b\w', lambda match: match.group(0).upper(), cleaned)


def get_available_category_names(db: Any) -> list[str]:
    existing_post_categories = [normalize_category_name(post.get('category', '')) for post in db['posts'].find({'status': 'approved'}, {'category': 1, '_id': 0})]
    approved_requests = [normalize_category_name(request.get('name', '')) for request in db['category_requests'].find({'status': 'approved'}, {'name': 1, '_id': 0})]
    merged = DEFAULT_CATEGORIES + existing_post_categories + approved_requests
    unique = [name for name in dict.fromkeys(merged) if name]
    return sorted(unique, key=str.casefold)


def hash_email(value: str) -> str:
    return hashlib.sha256(value.strip().lower().encode('utf-8')).hexdigest()


def encrypt_email(value: str) -> str:
    iv = secrets.token_bytes(16)
    key = hashlib.sha256(EMAIL_SECRET.encode('utf-8')).digest()
    from Crypto.Cipher import AES

    pad_len = 16 - (len(value) % 16)
    padded = value.encode('utf-8') + bytes([pad_len]) * pad_len
    cipher = AES.new(key, AES.MODE_CBC, iv)
    encrypted = cipher.encrypt(padded)
    return iv.hex() + ':' + encrypted.hex()


def decrypt_email(payload: str) -> str:
    if not payload:
        return ''
    if ':' not in payload:
        return payload
    try:
        iv_hex, encrypted_hex = payload.split(':', 1)
        key = hashlib.sha256(EMAIL_SECRET.encode('utf-8')).digest()
        from Crypto.Cipher import AES

        iv = bytes.fromhex(iv_hex)
        encrypted = bytes.fromhex(encrypted_hex)
        cipher = AES.new(key, AES.MODE_CBC, iv)
        padded = cipher.decrypt(encrypted)
        pad_len = padded[-1]
        return padded[:-pad_len].decode('utf-8')
    except Exception:
        return ''


import bcrypt

def hash_password(value: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(value.encode('utf-8'), salt).decode('utf-8')


def verify_password(candidate: str, stored: str) -> bool:
    try:
        return bcrypt.checkpw(candidate.encode('utf-8'), stored.encode('utf-8'))
    except Exception:
        return False


def create_token(user_id: ObjectId) -> str:
    expires_at = now_utc() + timedelta(days=7)
    payload = {'userId': str(user_id), 'exp': expires_at}
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')


def decode_token(token: str) -> Dict[str, Any]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
    except JWTError as exc:
        raise HTTPException(status_code=401, detail='Invalid token') from exc


def serialize_user(user: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not user:
        return None

    superior_until = user.get('superiorUntil')
    if isinstance(superior_until, datetime):
        superior_until = superior_until.isoformat()

    role = user.get('role', 'user')
    superior_until_dt = as_aware_utc(superior_until)
    is_superior_active = role == 'admin' or bool(superior_until_dt and superior_until_dt > now_utc())

    return {
        'id': str(user['_id']),
        'username': user.get('username'),
        'email': decrypt_email(user.get('emailEncrypted', '')),
        'role': role,
        'superiorUntil': superior_until,
        'profileImage': user.get('profileImage', ''),
        'bio': user.get('bio', ''),
        'location': user.get('location', 'Peenya Industrial Area'),
        'sustainabilityScore': user.get('sustainabilityScore', 10),
        'isSuperiorActive': is_superior_active,
    }


def serialize_public_user(user: Dict[str, Any]) -> Dict[str, Any]:
    return {
        'id': str(user['_id']),
        'username': user.get('username'),
        'role': user.get('role', 'user'),
        'profileImage': user.get('profileImage', ''),
        'location': user.get('location', 'Peenya Industrial Area'),
        'sustainabilityScore': user.get('sustainabilityScore', 10),
    }


def serialize_post(post: Dict[str, Any], db: Any) -> Dict[str, Any]:
    seller = None
    seller_id = post.get('seller')
    if seller_id:
        seller_doc = db['users'].find_one({'_id': seller_id})
        if seller_doc:
            seller = serialize_public_user(seller_doc)

    return {
        '_id': str(post['_id']),
        'seller': seller,
        'category': post.get('category'),
        'title': post.get('title'),
        'description': post.get('description'),
        'purpose': post.get('purpose'),
        'priceMin': post.get('priceMin'),
        'quantityValue': post.get('quantityValue'),
        'quantityUnit': post.get('quantityUnit'),
        'imageUrl': post.get('imageUrl', ''),
        'wasteAttributes': post.get('wasteAttributes', {}),
        'status': post.get('status', 'pending'),
        'flaggedReason': post.get('flaggedReason', ''),
        'createdAt': post.get('createdAt').isoformat() if isinstance(post.get('createdAt'), datetime) else post.get('createdAt'),
        'updatedAt': post.get('updatedAt').isoformat() if isinstance(post.get('updatedAt'), datetime) else post.get('updatedAt'),
    }


def serialize_conversation(conversation: Dict[str, Any], db: Any) -> Dict[str, Any]:
    participants = []
    for participant_id in conversation.get('participants', []):
        participant_doc = db['users'].find_one({'_id': participant_id})
        if participant_doc:
            participants.append({
                'id': str(participant_doc['_id']),
                'username': participant_doc.get('username'),
                'profileImage': participant_doc.get('profileImage', ''),
            })

    post = None
    post_doc = db['posts'].find_one({'_id': conversation.get('post')})
    if post_doc:
        post = {
            'id': str(post_doc['_id']),
            'title': post_doc.get('title'),
            'category': post_doc.get('category'),
        }

    return {
        '_id': str(conversation['_id']),
        'participants': participants,
        'post': post,
        'lastMessageAt': conversation.get('lastMessageAt').isoformat() if isinstance(conversation.get('lastMessageAt'), datetime) else conversation.get('lastMessageAt'),
        'createdAt': conversation.get('createdAt').isoformat() if isinstance(conversation.get('createdAt'), datetime) else conversation.get('createdAt'),
        'updatedAt': conversation.get('updatedAt').isoformat() if isinstance(conversation.get('updatedAt'), datetime) else conversation.get('updatedAt'),
    }


def serialize_message(message: Dict[str, Any], db: Any) -> Dict[str, Any]:
    sender = None
    sender_doc = db['users'].find_one({'_id': message.get('sender')})
    if sender_doc:
        sender = {
            'id': str(sender_doc['_id']),
            'username': sender_doc.get('username'),
            'profileImage': sender_doc.get('profileImage', ''),
        }

    return {
        '_id': str(message['_id']),
        'conversation': str(message.get('conversation')),
        'sender': sender,
        'text': message.get('text', ''),
        'createdAt': message.get('createdAt').isoformat() if isinstance(message.get('createdAt'), datetime) else message.get('createdAt'),
    }


async def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Authentication required')

    token = authorization.split(' ', 1)[1]
    payload = decode_token(token)
    user_id_value = str(payload.get('userId', ''))
    if not ObjectId.is_valid(user_id_value):
        raise HTTPException(status_code=401, detail='Invalid token')
    user_id = ObjectId(user_id_value)
    user = get_db()['users'].find_one({'_id': user_id})
    if not user:
        raise HTTPException(status_code=401, detail='User not found')

    superior_until = as_aware_utc(user.get('superiorUntil'))
    if user.get('role') == 'superior' and superior_until and superior_until <= now_utc():
        get_db()['users'].update_one({'_id': user['_id']}, {'$set': {'role': 'user', 'superiorUntil': None}})
        user['role'] = 'user'
        user['superiorUntil'] = None

    return user


async def get_optional_current_user(authorization: Optional[str] = Header(None)) -> Optional[Dict[str, Any]]:
    if not authorization:
        return None
    return await get_current_user(authorization)


def require_admin(user: Dict[str, Any]) -> Dict[str, Any]:
    if user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Access denied')
    return user


def require_superior_access(user: Dict[str, Any]) -> Dict[str, Any]:
    superior_until = as_aware_utc(user.get('superiorUntil'))
    active_superior = user.get('role') == 'admin' or bool(superior_until and superior_until > now_utc())
    if not active_superior:
        raise HTTPException(status_code=403, detail='Upgrade required to upload posts')
    return user


class RegisterPayload(BaseModel):
    username: str
    email: str
    password: str


class LoginPayload(BaseModel):
    email: Optional[str] = None
    username: Optional[str] = None
    password: str


class ProfilePayload(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    currentPassword: Optional[str] = None
    newPassword: Optional[str] = None
    profileImage: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None


class UpgradeRequestPayload(BaseModel):
    paymentReference: str
    months: int = 1


class PostCreatePayload(BaseModel):
    category: str
    title: str
    description: str
    purpose: str
    priceMin: float
    quantityValue: float
    quantityUnit: str
    imageUrl: Optional[str] = ''
    wasteAttributes: Optional[Dict[str, Any]] = Field(default_factory=dict)


class CategoryRequestPayload(BaseModel):
    name: str
    description: Optional[str] = ''


class ConversationPayload(BaseModel):
    postId: str


class MessagePayload(BaseModel):
    text: str


class ReviewPayload(BaseModel):
    status: str
    flaggedReason: Optional[str] = ''


class AdminReviewPayload(BaseModel):
    status: str
    paymentConfirmed: Optional[bool] = False
    adminNote: Optional[str] = ''


class CategoryReviewPayload(BaseModel):
    status: str
    adminNote: Optional[str] = ''


@app.on_event('startup')
def startup_event() -> None:
    try:
        connect_db()
    except Exception as exc:  # pragma: no cover - startup resilience
        print(f'Warning: MongoDB connection unavailable during startup: {exc}')


@app.get('/api/health')
def health() -> Dict[str, Any]:
    return {'ok': True, 'service': 'zero-waste-backend'}


@app.post('/api/auth/register', status_code=201)
def register(payload: RegisterPayload) -> Dict[str, Any]:
    db = get_db()
    username = payload.username.strip()
    email = payload.email.strip().lower()
    if not username or not email or not payload.password:
        raise HTTPException(status_code=400, detail='Username, email, and password are required')

    existing = db['users'].find_one({'$or': [{'username': username}, {'emailHash': hash_email(email)}]})
    if existing:
        raise HTTPException(status_code=409, detail='Username or email already exists')

    try:
        user_id = db['users'].insert_one({
            'username': username,
            'emailHash': hash_email(email),
            'emailEncrypted': encrypt_email(email),
            'password': hash_password(payload.password),
            'role': 'user',
            'sustainabilityScore': 10,
            'profileImage': '',
            'bio': '',
            'location': 'Peenya Industrial Area',
            'createdAt': now_utc(),
            'updatedAt': now_utc(),
        }).inserted_id
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=409, detail='Username or email already exists') from exc

    user = db['users'].find_one({'_id': user_id})
    token = create_token(user_id)
    return {'token': token, 'user': serialize_user(user)}


@app.post('/api/auth/login')
def login(payload: LoginPayload) -> Dict[str, Any]:
    db = get_db()
    identifier = str(payload.email or payload.username or '').strip()
    if not identifier or not payload.password:
        raise HTTPException(status_code=400, detail='Email or username and password are required')

    normalized = identifier.lower()
    user = db['users'].find_one({'$or': [{'emailHash': hash_email(normalized)}, {'username': identifier}]})
    if not user or not verify_password(payload.password, user.get('password', '')):
        raise HTTPException(status_code=401, detail='Invalid email or password')

    token = create_token(user['_id'])
    return {'token': token, 'user': serialize_user(user)}


@app.get('/api/auth/me')
def me(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    db = get_db()
    pending_upgrade = db['upgrade_requests'].find_one({'user': user['_id'], 'status': 'pending'}, sort=[('createdAt', -1)])
    return {'user': serialize_user(user), 'pendingUpgrade': None if pending_upgrade is None else {
        '_id': str(pending_upgrade['_id']),
        'status': pending_upgrade.get('status'),
        'months': pending_upgrade.get('months', 1),
        'amount': pending_upgrade.get('amount', 100),
        'paymentReference': pending_upgrade.get('paymentReference', ''),
    }}


@app.put('/api/auth/profile')
def update_profile(payload: ProfilePayload, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    db = get_db()
    if not payload.currentPassword or not verify_password(payload.currentPassword, user.get('password', '')):
        raise HTTPException(status_code=401, detail='Current password is required to update your profile')

    updates: Dict[str, Any] = {'updatedAt': now_utc()}
    if payload.username and payload.username != user.get('username'):
        taken = db['users'].find_one({'username': payload.username.strip(), '_id': {'$ne': user['_id']}})
        if taken:
            raise HTTPException(status_code=409, detail='Username is already taken')
        updates['username'] = payload.username.strip()

    if payload.email:
        normalized_email = payload.email.strip().lower()
        taken_email = db['users'].find_one({'emailHash': hash_email(normalized_email), '_id': {'$ne': user['_id']}})
        if taken_email:
            raise HTTPException(status_code=409, detail='Email is already taken')
        updates['emailHash'] = hash_email(normalized_email)
        updates['emailEncrypted'] = encrypt_email(normalized_email)

    if payload.newPassword:
        updates['password'] = hash_password(payload.newPassword)
    if payload.profileImage is not None:
        updates['profileImage'] = payload.profileImage
    if payload.bio is not None:
        updates['bio'] = payload.bio
    if payload.location is not None:
        updates['location'] = payload.location

    db['users'].update_one({'_id': user['_id']}, {'$set': updates})
    refreshed = db['users'].find_one({'_id': user['_id']})
    return {'user': serialize_user(refreshed)}


@app.post('/api/auth/upgrade-request', status_code=201)
def request_upgrade(payload: UpgradeRequestPayload, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    db = get_db()
    if not payload.paymentReference:
        raise HTTPException(status_code=400, detail='Payment reference is required')

    existing_pending = db['upgrade_requests'].find_one({'user': user['_id'], 'status': 'pending'})
    if existing_pending:
        raise HTTPException(status_code=409, detail='You already have a pending upgrade request')

    months = max(1, min(12, int(payload.months or 1)))
    request_id = db['upgrade_requests'].insert_one({
        'user': user['_id'],
        'paymentReference': payload.paymentReference.strip(),
        'months': months,
        'amount': 100 * months,
        'status': 'pending',
        'createdAt': now_utc(),
        'updatedAt': now_utc(),
    }).inserted_id

    request = db['upgrade_requests'].find_one({'_id': request_id})
    return {'request': {
        '_id': str(request['_id']),
        'paymentReference': request.get('paymentReference'),
        'months': request.get('months', 1),
        'amount': request.get('amount', 100),
        'status': request.get('status', 'pending'),
    }}


@app.get('/api/posts')
def list_posts(
    search: Optional[str] = Query(default=None),
    category: Optional[str] = None,
    status: str = 'approved',
    seller: Optional[str] = None,
    mine: Optional[str] = None,
    minPrice: Optional[float] = None,
    maxPrice: Optional[float] = None,
    dateAdded: Optional[str] = None,
    sort: str = 'newest',
    user: Optional[Dict[str, Any]] = Depends(get_optional_current_user),
) -> Dict[str, Any]:
    db = get_db()
    query: Dict[str, Any] = {}
    if status:
        query['status'] = status
    if category:
        query['category'] = category
    if seller:
        query['seller'] = parse_object_id(seller, 'seller id')
    if mine == 'true' and user is not None:
        query['seller'] = user['_id']
    if search:
        query['$or'] = [
            {'title': {'$regex': search, '$options': 'i'}},
            {'description': {'$regex': search, '$options': 'i'}},
            {'category': {'$regex': search, '$options': 'i'}},
            {'purpose': {'$regex': search, '$options': 'i'}},
        ]
    if minPrice is not None or maxPrice is not None:
        query['priceMin'] = {}
        if minPrice is not None:
            query['priceMin']['$gte'] = float(minPrice)
        if maxPrice is not None:
            query['priceMin']['$lte'] = float(maxPrice)
    if dateAdded:
        now = now_utc()
        threshold = now
        if dateAdded == 'today':
            threshold = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif dateAdded == '7d':
            threshold = now - timedelta(days=7)
        elif dateAdded == '30d':
            threshold = now - timedelta(days=30)
        if dateAdded in {'today', '7d', '30d'}:
            query['createdAt'] = {'$gte': threshold}

    sort_map = {
        'newest': [('createdAt', -1)],
        'oldest': [('createdAt', 1)],
        'price-low': [('priceMin', 1), ('createdAt', -1)],
        'price-high': [('priceMin', -1), ('createdAt', -1)],
    }
    cursor = db['posts'].find(query).sort(sort_map.get(sort, sort_map['newest'])).limit(100)
    posts = [serialize_post(post, db) for post in cursor]
    return {'posts': posts}


@app.get('/api/posts/categories')
def categories() -> Dict[str, Any]:
    db = get_db()
    return {'categories': get_available_category_names(db)}


@app.get('/api/posts/mine')
def my_posts(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    db = get_db()
    posts = [serialize_post(post, db) for post in db['posts'].find({'seller': user['_id']}).sort('createdAt', -1)]
    return {'posts': posts}


@app.post('/api/posts/categories/request', status_code=201)
def request_category(payload: CategoryRequestPayload, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    db = get_db()
    name = normalize_category_name(payload.name)
    if not name:
        raise HTTPException(status_code=400, detail='Category name is required')
    if name in get_available_category_names(db):
        raise HTTPException(status_code=409, detail='That category already exists')
    existing_pending = db['category_requests'].find_one({'name': name, 'status': 'pending'})
    if existing_pending:
        raise HTTPException(status_code=409, detail='That category is already waiting for admin review')

    request_id = db['category_requests'].insert_one({
        'name': name,
        'description': (payload.description or '').strip(),
        'requestedBy': user['_id'],
        'status': 'pending',
        'createdAt': now_utc(),
        'updatedAt': now_utc(),
    }).inserted_id
    request = db['category_requests'].find_one({'_id': request_id})
    return {'request': {
        '_id': str(request['_id']),
        'name': request.get('name'),
        'description': request.get('description', ''),
        'status': request.get('status', 'pending'),
    }}


@app.post('/api/posts', status_code=201)
def create_post(payload: PostCreatePayload, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    require_superior_access(user)
    db = get_db()
    category = normalize_category_name(payload.category)
    if not category:
        raise HTTPException(status_code=400, detail='Choose an approved category or request a new one first')
    approved_categories = set(get_available_category_names(db))
    if category not in approved_categories:
        raise HTTPException(status_code=400, detail='Choose an approved category or request a new one first')

    post_id = db['posts'].insert_one({
        'seller': user['_id'],
        'category': category,
        'title': payload.title,
        'description': payload.description,
        'purpose': payload.purpose,
        'priceMin': float(payload.priceMin),
        'quantityValue': float(payload.quantityValue),
        'quantityUnit': payload.quantityUnit,
        'imageUrl': payload.imageUrl or '',
        'wasteAttributes': payload.wasteAttributes or {},
        'status': 'pending',
        'flaggedReason': '',
        'createdAt': now_utc(),
        'updatedAt': now_utc(),
    }).inserted_id
    db['users'].update_one({'_id': user['_id']}, {'$inc': {'sustainabilityScore': 8}})
    post = db['posts'].find_one({'_id': post_id})
    return {'post': serialize_post(post, db)}


@app.delete('/api/posts/{post_id}')
def delete_post(post_id: str, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    db = get_db()
    post_object_id = parse_object_id(post_id, 'post id')
    post = db['posts'].find_one({'_id': post_object_id})
    if not post:
        raise HTTPException(status_code=404, detail='Post not found')
    if str(post['seller']) != str(user['_id']) and user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Not allowed to remove this post')
    db['posts'].delete_one({'_id': post_object_id})
    return {'message': 'Post removed'}


@app.get('/api/chat/conversations')
def list_conversations(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    db = get_db()
    conversations = [serialize_conversation(conversation, db) for conversation in db['conversations'].find({'participants': user['_id']}).sort('lastMessageAt', -1)]
    return {'conversations': conversations}


@app.post('/api/chat/conversations', status_code=201)
def open_conversation(payload: ConversationPayload, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    db = get_db()
    post = db['posts'].find_one({'_id': parse_object_id(payload.postId, 'post id')})
    if not post:
        raise HTTPException(status_code=404, detail='Post not found')
    if str(post['seller']) == str(user['_id']):
        raise HTTPException(status_code=400, detail='You cannot start a chat with your own post')

    participant_ids = sorted([user['_id'], post['seller']], key=str)
    conversation = db['conversations'].find_one({'post': post['_id'], 'participants': {'$all': participant_ids, '$size': 2}})
    if not conversation:
        timestamp = now_utc()
        convo_id = db['conversations'].insert_one({
            'participants': participant_ids,
            'post': post['_id'],
            'lastMessageAt': timestamp,
            'createdAt': timestamp,
            'updatedAt': timestamp,
        }).inserted_id
        conversation = db['conversations'].find_one({'_id': convo_id})
    return {'conversation': serialize_conversation(conversation, db)}


@app.get('/api/chat/conversations/{conversation_id}/messages')
def get_messages(conversation_id: str, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    db = get_db()
    conversation = db['conversations'].find_one({'_id': parse_object_id(conversation_id, 'conversation id')})
    if not conversation or user['_id'] not in conversation.get('participants', []):
        raise HTTPException(status_code=404, detail='Conversation not found')
    messages = [serialize_message(message, db) for message in db['messages'].find({'conversation': conversation['_id']}).sort('createdAt', 1)]
    return {'messages': messages}


@app.post('/api/chat/conversations/{conversation_id}/messages', status_code=201)
def send_message(conversation_id: str, payload: MessagePayload, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    db = get_db()
    conversation_id_object = parse_object_id(conversation_id, 'conversation id')
    conversation = db['conversations'].find_one({'_id': conversation_id_object})
    if not conversation or user['_id'] not in conversation.get('participants', []):
        raise HTTPException(status_code=404, detail='Conversation not found')
    message_id = db['messages'].insert_one({
        'conversation': conversation['_id'],
        'sender': user['_id'],
        'text': payload.text,
        'createdAt': now_utc(),
    }).inserted_id
    db['conversations'].update_one({'_id': conversation['_id']}, {'$set': {'lastMessageAt': now_utc(), 'updatedAt': now_utc()}})
    message = db['messages'].find_one({'_id': message_id})
    return {'message': serialize_message(message, db)}


@app.get('/api/admin/dashboard')
def admin_dashboard(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    require_admin(user)
    db = get_db()
    pending_posts = [serialize_post(post, db) for post in db['posts'].find({'status': 'pending'}).sort('createdAt', -1)]
    pending_requests = []
    for request in db['upgrade_requests'].find({'status': 'pending'}).sort('createdAt', -1):
        pending_requests.append({
            '_id': str(request['_id']),
            'status': request.get('status'),
            'paymentReference': request.get('paymentReference'),
            'months': request.get('months', 1),
            'amount': request.get('amount', 100),
            'user': serialize_user(db['users'].find_one({'_id': request['user']})) if request.get('user') else None,
        })
    users = [serialize_user(user_doc) for user_doc in db['users'].find({}, {'password': 0}).sort('createdAt', -1)]
    pending_categories = []
    for request in db['category_requests'].find({'status': 'pending'}).sort('createdAt', -1):
        pending_categories.append({
            '_id': str(request['_id']),
            'name': request.get('name'),
            'description': request.get('description', ''),
            'requestedBy': serialize_user(db['users'].find_one({'_id': request['requestedBy']})) if request.get('requestedBy') else None,
            'createdAt': request.get('createdAt').isoformat() if isinstance(request.get('createdAt'), datetime) else request.get('createdAt'),
            'updatedAt': request.get('updatedAt').isoformat() if isinstance(request.get('updatedAt'), datetime) else request.get('updatedAt'),
        })
    return {'pendingPosts': pending_posts, 'requests': pending_requests, 'users': users, 'pendingCategories': pending_categories}


@app.put('/api/admin/posts/{post_id}')
def review_post(post_id: str, payload: ReviewPayload, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    require_admin(user)
    db = get_db()
    if payload.status not in {'pending', 'approved', 'rejected'}:
        raise HTTPException(status_code=400, detail='Invalid post status')
    post_object_id = parse_object_id(post_id, 'post id')
    post = db['posts'].find_one({'_id': post_object_id})
    if not post:
        raise HTTPException(status_code=404, detail='Post not found')
    db['posts'].update_one({'_id': post_object_id}, {'$set': {'status': payload.status, 'flaggedReason': payload.flaggedReason or '', 'updatedAt': now_utc()}})
    updated = db['posts'].find_one({'_id': post_object_id})
    return {'post': serialize_post(updated, db)}


@app.put('/api/admin/upgrades/{request_id}')
def review_upgrade(request_id: str, payload: AdminReviewPayload, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    require_admin(user)
    db = get_db()
    if payload.status not in {'approved', 'rejected'}:
        raise HTTPException(status_code=400, detail='Invalid upgrade status')
    request_object_id = parse_object_id(request_id, 'upgrade request id')
    request = db['upgrade_requests'].find_one({'_id': request_object_id})
    if not request:
        raise HTTPException(status_code=404, detail='Upgrade request not found')
    if payload.status == 'approved' and not payload.paymentConfirmed:
        raise HTTPException(status_code=400, detail='Payment must be confirmed before approval')

    db['upgrade_requests'].update_one({'_id': request_object_id}, {'$set': {'status': payload.status, 'adminNote': payload.adminNote or '', 'approvedBy': user['_id'], 'updatedAt': now_utc()}})
    if payload.status == 'approved':
        target_user = db['users'].find_one({'_id': request['user']})
        if target_user:
            current_superior_until = as_aware_utc(target_user.get('superiorUntil'))
            start = current_superior_until if current_superior_until and current_superior_until > now_utc() else now_utc()
            next_date = start + timedelta(days=30 * int(request.get('months', 1)))
            db['users'].update_one({'_id': request['user']}, {'$set': {'role': 'superior', 'superiorUntil': next_date, 'updatedAt': now_utc()}, '$inc': {'sustainabilityScore': 20}})
    updated_request = db['upgrade_requests'].find_one({'_id': request_object_id})
    return {'request': {
        '_id': str(updated_request['_id']),
        'status': updated_request.get('status'),
        'paymentReference': updated_request.get('paymentReference'),
        'months': updated_request.get('months', 1),
        'amount': updated_request.get('amount', 100),
    }}


@app.put('/api/admin/categories/{request_id}')
def review_category(request_id: str, payload: CategoryReviewPayload, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    require_admin(user)
    db = get_db()
    if payload.status not in {'approved', 'rejected'}:
        raise HTTPException(status_code=400, detail='Invalid category status')
    request_object_id = parse_object_id(request_id, 'category request id')
    request = db['category_requests'].find_one({'_id': request_object_id})
    if not request:
        raise HTTPException(status_code=404, detail='Category request not found')
    db['category_requests'].update_one({'_id': request_object_id}, {'$set': {'status': payload.status, 'adminNote': payload.adminNote or '', 'reviewedBy': user['_id'], 'updatedAt': now_utc()}})
    updated_request = db['category_requests'].find_one({'_id': request_object_id})
    return {'request': {
        '_id': str(updated_request['_id']),
        'name': updated_request.get('name'),
        'description': updated_request.get('description', ''),
        'status': updated_request.get('status'),
    }}


@app.get('/api/graph')
def get_graph_data() -> Dict[str, Any]:
    db = get_db()
    approved_posts = [post for post in db['posts'].find({'status': 'approved'})]
    users = list(db['users'].find({'role': {'$ne': 'admin'}}, {'password': 0}))
    nodes = []
    for user_doc in users:
        nodes.append({'id': str(user_doc['_id']), 'label': user_doc.get('username', 'User'), 'score': user_doc.get('sustainabilityScore', 0)})

    links = []
    for i in range(len(approved_posts)):
        for j in range(i + 1, len(approved_posts)):
            a = approved_posts[i]
            b = approved_posts[j]
            seller_a = db['users'].find_one({'_id': a.get('seller')})
            seller_b = db['users'].find_one({'_id': b.get('seller')})
            if not seller_a or not seller_b:
                continue
            if seller_a.get('role') == 'admin' or seller_b.get('role') == 'admin':
                continue
            if str(a.get('seller')) == str(b.get('seller')):
                continue
            if a.get('category') == b.get('category') or str(a.get('purpose', '')).lower().find(str(b.get('category', '')).lower()) != -1 or str(b.get('purpose', '')).lower().find(str(a.get('category', '')).lower()) != -1:
                links.append({'source': str(a['seller']), 'target': str(b['seller']), 'value': int((a.get('priceMin', 0) + b.get('priceMin', 0)) / 2)})
    return {'nodes': nodes, 'links': links[:40]}


FRONTEND_DIST = PROJECT_ROOT / 'frontend' / 'dist'
if FRONTEND_DIST.exists():
    assets_dir = FRONTEND_DIST / 'assets'
    if assets_dir.exists():
        app.mount('/assets', StaticFiles(directory=assets_dir), name='assets')

    @app.get('/')
    @app.get('/{full_path:path}')
    def serve_frontend(full_path: str = ''):
        if full_path.startswith('api/'):
            raise HTTPException(status_code=404, detail='Not found')

        requested_path = FRONTEND_DIST / full_path
        if full_path and requested_path.is_file():
            return FileResponse(requested_path)

        return FileResponse(FRONTEND_DIST / 'index.html')


@app.exception_handler(HTTPException)
async def http_exception_handler(_request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={'message': exc.detail})


@app.exception_handler(Exception)
async def unhandled_exception_handler(_request, exc: Exception) -> JSONResponse:
    return JSONResponse(status_code=500, content={'message': 'Internal server error'})
