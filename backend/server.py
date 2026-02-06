from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, WebSocket, WebSocketDisconnect, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
import json
import aiofiles

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Settings
SECRET_KEY = os.environ.get('JWT_SECRET', 'your-super-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Create the main app
app = FastAPI()

# Create uploads directory
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

security = HTTPBearer()

# ===================== MODELS =====================

class UserCreate(BaseModel):
    username: str
    password: str
    display_name: str

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    username: str
    display_name: str
    avatar: Optional[str] = None
    is_online: bool = False
    last_seen: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class MessageCreate(BaseModel):
    content: Optional[str] = None
    type: str = "text"  # text, image, video, voice
    reply_to: Optional[str] = None

class MessageResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    sender_id: str
    sender_name: str
    content: Optional[str] = None
    type: str
    file_url: Optional[str] = None
    reply_to: Optional[dict] = None
    timestamp: str
    status: str = "sent"

class ConversationResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    participants: List[UserResponse]
    last_message: Optional[MessageResponse] = None
    unread_count: int = 0

# ===================== AUTH HELPERS =====================

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ===================== AUTH ROUTES =====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    # Check if username exists
    existing = await db.users.find_one({"username": user_data.username})
    if existing:
        raise HTTPException(status_code=400, detail="نام کاربری قبلاً استفاده شده است")
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "username": user_data.username,
        "password": get_password_hash(user_data.password),
        "display_name": user_data.display_name,
        "avatar": None,
        "is_online": False,
        "last_seen": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    token = create_access_token({"sub": user_id})
    user_response = UserResponse(
        id=user_id,
        username=user_data.username,
        display_name=user_data.display_name,
        avatar=None,
        is_online=False
    )
    
    return TokenResponse(access_token=token, user=user_response)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(user_data: UserLogin):
    user = await db.users.find_one({"username": user_data.username}, {"_id": 0})
    if not user or not verify_password(user_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="نام کاربری یا رمز عبور اشتباه است")
    
    token = create_access_token({"sub": user["id"]})
    
    # Update online status
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"is_online": True, "last_seen": datetime.now(timezone.utc).isoformat()}}
    )
    
    user_response = UserResponse(
        id=user["id"],
        username=user["username"],
        display_name=user["display_name"],
        avatar=user.get("avatar"),
        is_online=True
    )
    
    return TokenResponse(access_token=token, user=user_response)

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"],
        username=current_user["username"],
        display_name=current_user["display_name"],
        avatar=current_user.get("avatar"),
        is_online=current_user.get("is_online", False),
        last_seen=current_user.get("last_seen")
    )

@api_router.post("/auth/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"is_online": False, "last_seen": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "با موفقیت خارج شدید"}

# ===================== USER ROUTES =====================

@api_router.get("/users", response_model=List[UserResponse])
async def get_users(current_user: dict = Depends(get_current_user)):
    users = await db.users.find({"id": {"$ne": current_user["id"]}}, {"_id": 0, "password": 0}).to_list(100)
    return [UserResponse(**u) for u in users]

@api_router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد")
    return UserResponse(**user)

@api_router.put("/users/profile")
async def update_profile(display_name: str = None, current_user: dict = Depends(get_current_user)):
    update_data = {}
    if display_name:
        update_data["display_name"] = display_name
    
    if update_data:
        await db.users.update_one({"id": current_user["id"]}, {"$set": update_data})
    
    return {"message": "پروفایل به‌روزرسانی شد"}

# ===================== CONVERSATION ROUTES =====================

@api_router.get("/conversations", response_model=List[ConversationResponse])
async def get_conversations(current_user: dict = Depends(get_current_user)):
    conversations = await db.conversations.find(
        {"participants": current_user["id"]},
        {"_id": 0}
    ).to_list(100)
    
    result = []
    for conv in conversations:
        participants = []
        for pid in conv["participants"]:
            p = await db.users.find_one({"id": pid}, {"_id": 0, "password": 0})
            if p:
                participants.append(UserResponse(**p))
        
        last_msg = None
        if conv.get("last_message_id"):
            msg = await db.messages.find_one({"id": conv["last_message_id"]}, {"_id": 0})
            if msg:
                last_msg = MessageResponse(**msg)
        
        result.append(ConversationResponse(
            id=conv["id"],
            participants=participants,
            last_message=last_msg,
            unread_count=conv.get("unread_count", {}).get(current_user["id"], 0)
        ))
    
    return result

@api_router.post("/conversations/{other_user_id}", response_model=ConversationResponse)
async def create_or_get_conversation(other_user_id: str, current_user: dict = Depends(get_current_user)):
    # Check if conversation exists
    existing = await db.conversations.find_one({
        "participants": {"$all": [current_user["id"], other_user_id]}
    }, {"_id": 0})
    
    if existing:
        participants = []
        for pid in existing["participants"]:
            p = await db.users.find_one({"id": pid}, {"_id": 0, "password": 0})
            if p:
                participants.append(UserResponse(**p))
        return ConversationResponse(
            id=existing["id"],
            participants=participants,
            unread_count=0
        )
    
    # Create new conversation
    conv_id = str(uuid.uuid4())
    conv_doc = {
        "id": conv_id,
        "participants": [current_user["id"], other_user_id],
        "last_message_id": None,
        "unread_count": {current_user["id"]: 0, other_user_id: 0},
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.conversations.insert_one(conv_doc)
    
    participants = []
    for pid in [current_user["id"], other_user_id]:
        p = await db.users.find_one({"id": pid}, {"_id": 0, "password": 0})
        if p:
            participants.append(UserResponse(**p))
    
    return ConversationResponse(id=conv_id, participants=participants, unread_count=0)

# ===================== MESSAGE ROUTES =====================

@api_router.get("/messages/{conversation_id}", response_model=List[MessageResponse])
async def get_messages(conversation_id: str, current_user: dict = Depends(get_current_user)):
    # Verify user is part of conversation
    conv = await db.conversations.find_one({"id": conversation_id}, {"_id": 0})
    if not conv or current_user["id"] not in conv["participants"]:
        raise HTTPException(status_code=403, detail="دسترسی ندارید")
    
    messages = await db.messages.find(
        {"conversation_id": conversation_id},
        {"_id": 0}
    ).sort("timestamp", 1).to_list(1000)
    
    # Mark messages as read
    await db.messages.update_many(
        {"conversation_id": conversation_id, "sender_id": {"$ne": current_user["id"]}},
        {"$set": {"status": "read"}}
    )
    
    # Reset unread count
    await db.conversations.update_one(
        {"id": conversation_id},
        {"$set": {f"unread_count.{current_user['id']}": 0}}
    )
    
    return [MessageResponse(**m) for m in messages]

@api_router.post("/messages/{conversation_id}", response_model=MessageResponse)
async def send_message(conversation_id: str, message: MessageCreate, current_user: dict = Depends(get_current_user)):
    conv = await db.conversations.find_one({"id": conversation_id}, {"_id": 0})
    if not conv or current_user["id"] not in conv["participants"]:
        raise HTTPException(status_code=403, detail="دسترسی ندارید")
    
    reply_data = None
    if message.reply_to:
        reply_msg = await db.messages.find_one({"id": message.reply_to}, {"_id": 0})
        if reply_msg:
            reply_data = {
                "id": reply_msg["id"],
                "content": reply_msg.get("content"),
                "sender_name": reply_msg["sender_name"],
                "type": reply_msg["type"]
            }
    
    msg_id = str(uuid.uuid4())
    timestamp = datetime.now(timezone.utc).isoformat()
    
    msg_doc = {
        "id": msg_id,
        "conversation_id": conversation_id,
        "sender_id": current_user["id"],
        "sender_name": current_user["display_name"],
        "content": message.content,
        "type": message.type,
        "file_url": None,
        "reply_to": reply_data,
        "timestamp": timestamp,
        "status": "sent"
    }
    
    await db.messages.insert_one(msg_doc)
    
    # Update conversation
    other_user_id = [p for p in conv["participants"] if p != current_user["id"]][0]
    await db.conversations.update_one(
        {"id": conversation_id},
        {
            "$set": {"last_message_id": msg_id},
            "$inc": {f"unread_count.{other_user_id}": 1}
        }
    )
    
    return MessageResponse(**msg_doc)

@api_router.post("/upload/{conversation_id}")
async def upload_file(
    conversation_id: str,
    file: UploadFile = File(...),
    reply_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    conv = await db.conversations.find_one({"id": conversation_id}, {"_id": 0})
    if not conv or current_user["id"] not in conv["participants"]:
        raise HTTPException(status_code=403, detail="دسترسی ندارید")
    
    # Determine file type
    content_type = file.content_type or ""
    if content_type.startswith("image/"):
        file_type = "image"
    elif content_type.startswith("video/"):
        file_type = "video"
    elif content_type.startswith("audio/"):
        file_type = "voice"
    else:
        file_type = "file"
    
    # Save file
    file_ext = Path(file.filename).suffix if file.filename else ".bin"
    file_id = str(uuid.uuid4())
    file_name = f"{file_id}{file_ext}"
    file_path = UPLOAD_DIR / file_name
    
    async with aiofiles.open(file_path, "wb") as f:
        content = await file.read()
        await f.write(content)
    
    # Create message
    reply_data = None
    if reply_to:
        reply_msg = await db.messages.find_one({"id": reply_to}, {"_id": 0})
        if reply_msg:
            reply_data = {
                "id": reply_msg["id"],
                "content": reply_msg.get("content"),
                "sender_name": reply_msg["sender_name"],
                "type": reply_msg["type"]
            }
    
    msg_id = str(uuid.uuid4())
    timestamp = datetime.now(timezone.utc).isoformat()
    file_url = f"/uploads/{file_name}"
    
    msg_doc = {
        "id": msg_id,
        "conversation_id": conversation_id,
        "sender_id": current_user["id"],
        "sender_name": current_user["display_name"],
        "content": file.filename,
        "type": file_type,
        "file_url": file_url,
        "reply_to": reply_data,
        "timestamp": timestamp,
        "status": "sent"
    }
    
    await db.messages.insert_one(msg_doc)
    
    # Update conversation
    other_user_id = [p for p in conv["participants"] if p != current_user["id"]][0]
    await db.conversations.update_one(
        {"id": conversation_id},
        {
            "$set": {"last_message_id": msg_id},
            "$inc": {f"unread_count.{other_user_id}": 1}
        }
    )
    
    return MessageResponse(**msg_doc)

# ===================== WEBSOCKET =====================

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        await db.users.update_one({"id": user_id}, {"$set": {"is_online": True}})
    
    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
    
    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json(message)
            except:
                pass

manager = ConnectionManager()

@app.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=4001)
            return
    except JWTError:
        await websocket.close(code=4001)
        return
    
    await manager.connect(websocket, user_id)
    
    try:
        while True:
            data = await websocket.receive_json()
            
            if data.get("type") == "message":
                conv_id = data.get("conversation_id")
                conv = await db.conversations.find_one({"id": conv_id}, {"_id": 0})
                
                if conv and user_id in conv["participants"]:
                    user = await db.users.find_one({"id": user_id}, {"_id": 0})
                    
                    reply_data = None
                    if data.get("reply_to"):
                        reply_msg = await db.messages.find_one({"id": data["reply_to"]}, {"_id": 0})
                        if reply_msg:
                            reply_data = {
                                "id": reply_msg["id"],
                                "content": reply_msg.get("content"),
                                "sender_name": reply_msg["sender_name"],
                                "type": reply_msg["type"]
                            }
                    
                    msg_id = str(uuid.uuid4())
                    timestamp = datetime.now(timezone.utc).isoformat()
                    
                    msg_doc = {
                        "id": msg_id,
                        "conversation_id": conv_id,
                        "sender_id": user_id,
                        "sender_name": user["display_name"],
                        "content": data.get("content"),
                        "type": data.get("msg_type", "text"),
                        "file_url": data.get("file_url"),
                        "reply_to": reply_data,
                        "timestamp": timestamp,
                        "status": "sent"
                    }
                    
                    await db.messages.insert_one(msg_doc)
                    
                    # Update conversation
                    other_user_id = [p for p in conv["participants"] if p != user_id][0]
                    await db.conversations.update_one(
                        {"id": conv_id},
                        {
                            "$set": {"last_message_id": msg_id},
                            "$inc": {f"unread_count.{other_user_id}": 1}
                        }
                    )
                    
                    # Send to both users
                    response = {"type": "new_message", "message": msg_doc}
                    await manager.send_personal_message(response, user_id)
                    await manager.send_personal_message(response, other_user_id)
            
            elif data.get("type") == "typing":
                conv_id = data.get("conversation_id")
                conv = await db.conversations.find_one({"id": conv_id}, {"_id": 0})
                if conv:
                    other_user_id = [p for p in conv["participants"] if p != user_id][0]
                    await manager.send_personal_message(
                        {"type": "typing", "user_id": user_id, "conversation_id": conv_id},
                        other_user_id
                    )
            
            elif data.get("type") == "read":
                conv_id = data.get("conversation_id")
                await db.messages.update_many(
                    {"conversation_id": conv_id, "sender_id": {"$ne": user_id}},
                    {"$set": {"status": "read"}}
                )
                conv = await db.conversations.find_one({"id": conv_id}, {"_id": 0})
                if conv:
                    other_user_id = [p for p in conv["participants"] if p != user_id][0]
                    await manager.send_personal_message(
                        {"type": "messages_read", "conversation_id": conv_id},
                        other_user_id
                    )
    
    except WebSocketDisconnect:
        manager.disconnect(user_id)
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"is_online": False, "last_seen": datetime.now(timezone.utc).isoformat()}}
        )

# Include the router in the main app
app.include_router(api_router)

# Mount static files for uploads (after router to avoid path conflicts)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
