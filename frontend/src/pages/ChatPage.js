import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import EmojiPicker from 'emoji-picker-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { ScrollArea } from '../components/ui/scroll-area';
import { 
    Send, 
    Smile, 
    Paperclip, 
    Mic, 
    X, 
    Reply, 
    Moon,
    Sun,
    LogOut,
    User,
    Check,
    CheckCheck,
    Play,
    Pause,
    ArrowRight,
    Menu
} from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;
const WS_URL = API.replace('https://', 'wss://').replace('http://', 'ws://');

export default function ChatPage() {
    const { user, token, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [conversation, setConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [replyTo, setReplyTo] = useState(null);
    const [showEmoji, setShowEmoji] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [isTyping, setIsTyping] = useState(false);
    const [ws, setWs] = useState(null);
    const [showSidebar, setShowSidebar] = useState(true);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recordingIntervalRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    // Check mobile
    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (!mobile) setShowSidebar(true);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Fetch users
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const response = await axios.get(`${API}/api/users`);
                setUsers(response.data);
            } catch (error) {
                console.error('Error fetching users:', error);
            }
        };
        fetchUsers();
    }, []);

    // WebSocket connection
    useEffect(() => {
        if (!token) return;

        const websocket = new WebSocket(`${WS_URL}/ws/${token}`);
        
        websocket.onopen = () => {
            console.log('WebSocket connected');
        };

        websocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (data.type === 'new_message') {
                setMessages(prev => {
                    const exists = prev.find(m => m.id === data.message.id);
                    if (exists) return prev;
                    return [...prev, data.message];
                });
            } else if (data.type === 'typing') {
                if (data.conversation_id === conversation?.id) {
                    setIsTyping(true);
                    setTimeout(() => setIsTyping(false), 2000);
                }
            } else if (data.type === 'messages_read') {
                setMessages(prev => prev.map(m => ({ ...m, status: 'read' })));
            }
        };

        websocket.onclose = () => {
            console.log('WebSocket disconnected');
        };

        setWs(websocket);

        return () => {
            websocket.close();
        };
    }, [token, conversation?.id]);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Select user and get/create conversation
    const selectUser = async (selectedUserData) => {
        setSelectedUser(selectedUserData);
        if (isMobile) setShowSidebar(false);
        try {
            const convResponse = await axios.post(`${API}/api/conversations/${selectedUserData.id}`);
            setConversation(convResponse.data);
            
            const messagesResponse = await axios.get(`${API}/api/messages/${convResponse.data.id}`);
            setMessages(messagesResponse.data);
        } catch (error) {
            toast.error('خطا در بارگذاری پیام‌ها');
        }
    };

    // Back to sidebar (mobile)
    const goBack = () => {
        setShowSidebar(true);
        setSelectedUser(null);
    };

    // Send message
    const sendMessage = async () => {
        if (!newMessage.trim() || !conversation) return;

        const messageContent = newMessage;
        setNewMessage('');
        setShowEmoji(false);

        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'message',
                conversation_id: conversation.id,
                content: messageContent,
                msg_type: 'text',
                reply_to: replyTo?.id
            }));
        }
        setReplyTo(null);
    };

    // Handle typing
    const handleTyping = () => {
        if (ws && ws.readyState === WebSocket.OPEN && conversation) {
            ws.send(JSON.stringify({
                type: 'typing',
                conversation_id: conversation.id
            }));
        }

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {}, 2000);
    };

    // File upload
    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !conversation) return;

        const formData = new FormData();
        formData.append('file', file);
        if (replyTo) {
            formData.append('reply_to', replyTo.id);
        }

        try {
            const response = await axios.post(
                `${API}/api/upload/${conversation.id}`,
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } }
            );
            setMessages(prev => [...prev, response.data]);
            setReplyTo(null);
            toast.success('فایل ارسال شد');
        } catch (error) {
            toast.error('خطا در ارسال فایل');
        }
    };

    // Voice recording
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const formData = new FormData();
                formData.append('file', audioBlob, 'voice.webm');
                if (replyTo) {
                    formData.append('reply_to', replyTo.id);
                }

                try {
                    const response = await axios.post(
                        `${API}/api/upload/${conversation.id}`,
                        formData,
                        { headers: { 'Content-Type': 'multipart/form-data' } }
                    );
                    setMessages(prev => [...prev, response.data]);
                    setReplyTo(null);
                    toast.success('پیام صوتی ارسال شد');
                } catch (error) {
                    toast.error('خطا در ارسال پیام صوتی');
                }

                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);
            
            recordingIntervalRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (error) {
            toast.error('دسترسی به میکروفون رد شد');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (recordingIntervalRef.current) {
                clearInterval(recordingIntervalRef.current);
            }
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    const handleEmojiClick = (emojiData) => {
        setNewMessage(prev => prev + emojiData.emoji);
    };

    return (
        <div className="h-screen w-screen overflow-hidden flex" dir="rtl" data-testid="chat-page">
            {/* Sidebar */}
            <AnimatePresence>
                {(showSidebar || !isMobile) && (
                    <motion.div 
                        initial={isMobile ? { x: '100%' } : false}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'tween', duration: 0.2 }}
                        className={`${isMobile ? 'absolute inset-0 z-50' : 'w-80 border-l border-border'} bg-card flex flex-col`}
                        data-testid="sidebar"
                    >
                        {/* Header */}
                        <div className="p-4 glass flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                    <AvatarFallback className="bg-primary/10 text-primary">
                                        {user?.display_name?.[0]?.toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-medium text-sm">{user?.display_name}</p>
                                    <p className="text-xs text-muted-foreground">آنلاین</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={toggleTheme}
                                    data-testid="theme-toggle"
                                    className="h-9 w-9"
                                >
                                    {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleLogout}
                                    data-testid="logout-btn"
                                    className="h-9 w-9 text-destructive hover:text-destructive"
                                >
                                    <LogOut className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {/* User List */}
                        <ScrollArea className="flex-1">
                            <div className="p-3">
                                <p className="text-xs font-medium text-muted-foreground mb-3 px-2">کاربران</p>
                                {users.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground text-sm">
                                        هنوز کاربر دیگری ثبت‌نام نکرده
                                    </div>
                                ) : (
                                    users.map((u) => (
                                        <motion.button
                                            key={u.id}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => selectUser(u)}
                                            data-testid={`user-item-${u.id}`}
                                            className={`w-full p-3 md:p-3 rounded-xl flex items-center gap-3 transition-colors ${
                                                selectedUser?.id === u.id 
                                                    ? 'bg-primary/10 text-primary' 
                                                    : 'hover:bg-secondary active:bg-secondary'
                                            }`}
                                        >
                                            <div className="relative">
                                                <Avatar className="h-12 w-12 md:h-11 md:w-11">
                                                    <AvatarFallback className="bg-secondary text-lg">
                                                        {u.display_name?.[0]?.toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                {u.is_online && <div className="online-dot" />}
                                            </div>
                                            <div className="text-right flex-1 min-w-0">
                                                <p className="font-medium text-base md:text-sm truncate">{u.display_name}</p>
                                                <p className="text-sm md:text-xs text-muted-foreground">
                                                    {u.is_online ? 'آنلاین' : 'آفلاین'}
                                                </p>
                                            </div>
                                        </motion.button>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Chat Area */}
            <div className={`flex-1 flex flex-col bg-background ${isMobile && showSidebar ? 'hidden' : ''}`} data-testid="chat-area">
                {selectedUser ? (
                    <>
                        {/* Chat Header */}
                        <div className="glass p-3 md:p-4 flex items-center gap-3">
                            {isMobile && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={goBack}
                                    className="h-10 w-10 shrink-0"
                                    data-testid="back-btn"
                                >
                                    <ArrowRight className="h-5 w-5" />
                                </Button>
                            )}
                            <div className="relative">
                                <Avatar className="h-10 w-10">
                                    <AvatarFallback className="bg-secondary">
                                        {selectedUser.display_name?.[0]?.toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                {selectedUser.is_online && <div className="online-dot" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{selectedUser.display_name}</p>
                                <p className="text-xs text-muted-foreground">
                                    {isTyping ? (
                                        <span className="flex items-center gap-1">
                                            در حال تایپ
                                            <span className="flex gap-0.5">
                                                <span className="typing-dot w-1 h-1 bg-primary rounded-full" />
                                                <span className="typing-dot w-1 h-1 bg-primary rounded-full" />
                                                <span className="typing-dot w-1 h-1 bg-primary rounded-full" />
                                            </span>
                                        </span>
                                    ) : selectedUser.is_online ? 'آنلاین' : 'آفلاین'}
                                </p>
                            </div>
                        </div>

                        {/* Messages */}
                        <ScrollArea className="flex-1 p-3 md:p-4">
                            <div className="space-y-3 md:space-y-4 max-w-3xl mx-auto">
                                <AnimatePresence>
                                    {messages.map((msg) => (
                                        <MessageBubble
                                            key={msg.id}
                                            message={msg}
                                            isMe={msg.sender_id === user?.id}
                                            onReply={() => setReplyTo(msg)}
                                            isMobile={isMobile}
                                        />
                                    ))}
                                </AnimatePresence>
                                <div ref={messagesEndRef} />
                            </div>
                        </ScrollArea>

                        {/* Reply Preview */}
                        <AnimatePresence>
                            {replyTo && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="px-3 md:px-4 py-2 bg-secondary/50 border-t border-border"
                                >
                                    <div className="flex items-center justify-between max-w-3xl mx-auto">
                                        <div className="reply-preview flex-1 min-w-0">
                                            <p className="text-xs text-primary font-medium">
                                                پاسخ به {replyTo.sender_name}
                                            </p>
                                            <p className="text-sm text-muted-foreground truncate">
                                                {replyTo.type === 'text' ? replyTo.content : `[${replyTo.type}]`}
                                            </p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setReplyTo(null)}
                                            className="h-8 w-8 shrink-0"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Input Area */}
                        <div className="input-area p-3 md:p-4">
                            <div className="max-w-3xl mx-auto">
                                {/* Emoji Picker */}
                                <AnimatePresence>
                                    {showEmoji && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 20 }}
                                            className="mb-3"
                                        >
                                            <EmojiPicker
                                                onEmojiClick={handleEmojiClick}
                                                theme={theme}
                                                width="100%"
                                                height={isMobile ? 280 : 350}
                                                searchPlaceholder="جستجوی ایموجی..."
                                            />
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {isRecording ? (
                                    <div className="flex items-center gap-3 md:gap-4 bg-destructive/10 rounded-2xl p-3 md:p-4">
                                        <div className="relative shrink-0">
                                            <div className="recording-pulse w-10 h-10 md:w-12 md:h-12 rounded-full bg-destructive flex items-center justify-center">
                                                <Mic className="h-4 w-4 md:h-5 md:w-5 text-white relative z-10" />
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-destructive">در حال ضبط...</p>
                                            <p className="text-lg font-mono">{formatTime(recordingTime)}</p>
                                        </div>
                                        <div className="flex gap-2 shrink-0">
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => {
                                                    setIsRecording(false);
                                                    if (recordingIntervalRef.current) {
                                                        clearInterval(recordingIntervalRef.current);
                                                    }
                                                    if (mediaRecorderRef.current) {
                                                        mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
                                                    }
                                                }}
                                                className="rounded-full h-10 w-10"
                                                data-testid="cancel-recording"
                                            >
                                                <X className="h-5 w-5" />
                                            </Button>
                                            <Button
                                                onClick={stopRecording}
                                                className="rounded-full h-10 w-10"
                                                data-testid="stop-recording"
                                            >
                                                <Send className="h-5 w-5" />
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1 md:gap-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setShowEmoji(!showEmoji)}
                                            data-testid="emoji-btn"
                                            className="h-10 w-10 rounded-full shrink-0"
                                        >
                                            <Smile className="h-5 w-5" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => fileInputRef.current?.click()}
                                            data-testid="attach-btn"
                                            className="h-10 w-10 rounded-full shrink-0"
                                        >
                                            <Paperclip className="h-5 w-5" />
                                        </Button>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleFileUpload}
                                            accept="image/*,video/*"
                                            className="hidden"
                                        />
                                        <Input
                                            value={newMessage}
                                            onChange={(e) => {
                                                setNewMessage(e.target.value);
                                                handleTyping();
                                            }}
                                            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                                            placeholder="پیام..."
                                            data-testid="message-input"
                                            className="flex-1 rounded-full bg-secondary/50 border-0 h-10 md:h-11 text-base"
                                        />
                                        {newMessage.trim() ? (
                                            <Button
                                                onClick={sendMessage}
                                                data-testid="send-btn"
                                                className="h-10 w-10 md:h-11 md:w-11 rounded-full shrink-0"
                                            >
                                                <Send className="h-5 w-5" />
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="outline"
                                                onClick={startRecording}
                                                data-testid="record-btn"
                                                className="h-10 w-10 md:h-11 md:w-11 rounded-full shrink-0"
                                            >
                                                <Mic className="h-5 w-5" />
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className={`flex-1 flex items-center justify-center p-8 ${isMobile ? 'hidden' : ''}`}>
                        <div className="text-center">
                            <div className="w-20 h-20 md:w-24 md:h-24 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6">
                                <User className="w-10 h-10 md:w-12 md:h-12 text-muted-foreground" />
                            </div>
                            <h2 className="font-heading text-xl md:text-2xl font-bold mb-2">شروع گفتگو</h2>
                            <p className="text-muted-foreground text-sm md:text-base">یک کاربر از لیست انتخاب کنید</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Message Bubble Component
function MessageBubble({ message, isMe, onReply, isMobile }) {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef(null);
    const API_BASE = process.env.REACT_APP_BACKEND_URL;

    const toggleAudio = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const renderContent = () => {
        switch (message.type) {
            case 'image':
                return (
                    <img
                        src={`${API_BASE}${message.file_url}`}
                        alt="تصویر"
                        className="max-w-[200px] md:max-w-[300px] rounded-xl cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => window.open(`${API_BASE}${message.file_url}`, '_blank')}
                    />
                );
            case 'video':
                return (
                    <video
                        src={`${API_BASE}${message.file_url}`}
                        controls
                        className="max-w-[200px] md:max-w-[300px] rounded-xl"
                    />
                );
            case 'voice':
                return (
                    <div className="flex items-center gap-2 md:gap-3 min-w-[150px] md:min-w-[200px]">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleAudio}
                            className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-white/10 shrink-0"
                        >
                            {isPlaying ? <Pause className="h-4 w-4 md:h-5 md:w-5" /> : <Play className="h-4 w-4 md:h-5 md:w-5" />}
                        </Button>
                        <div className="flex-1 flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                                <div
                                    key={i}
                                    className={`voice-bar w-1 bg-current rounded-full ${isPlaying ? '' : 'h-2'}`}
                                    style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}
                                />
                            ))}
                        </div>
                        <audio
                            ref={audioRef}
                            src={`${API_BASE}${message.file_url}`}
                            onEnded={() => setIsPlaying(false)}
                        />
                    </div>
                );
            default:
                return <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>;
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            className={`flex ${isMe ? 'justify-start' : 'justify-end'} group`}
            data-testid={`message-${message.id}`}
        >
            <div className={`max-w-[85%] md:max-w-[75%] ${isMe ? 'order-1' : 'order-2'}`}>
                {/* Reply Preview */}
                {message.reply_to && (
                    <div className={`mb-1 px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-xs ${
                        isMe ? 'bg-primary/20' : 'bg-secondary'
                    }`}>
                        <p className="font-medium opacity-70">{message.reply_to.sender_name}</p>
                        <p className="truncate opacity-50">
                            {message.reply_to.type === 'text' ? message.reply_to.content : `[${message.reply_to.type}]`}
                        </p>
                    </div>
                )}
                
                {/* Message Content */}
                <div
                    className={`px-3 md:px-4 py-2 md:py-2.5 ${
                        isMe 
                            ? 'bg-primary text-primary-foreground bubble-me' 
                            : 'bg-secondary text-secondary-foreground bubble-other'
                    }`}
                >
                    {renderContent()}
                    <div className={`flex items-center gap-1.5 mt-1 text-[10px] ${
                        isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'
                    }`}>
                        <span>
                            {new Date(message.timestamp).toLocaleTimeString('fa-IR', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                            })}
                        </span>
                        {isMe && (
                            message.status === 'read' 
                                ? <CheckCheck className="h-3 w-3" />
                                : <Check className="h-3 w-3" />
                        )}
                    </div>
                </div>
            </div>
            
            {/* Reply Button */}
            <div className={`self-center ${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity ${
                isMe ? 'order-2 mr-1 md:mr-2' : 'order-1 ml-1 md:ml-2'
            }`}>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onReply}
                    className="h-7 w-7 md:h-8 md:w-8 rounded-full"
                    data-testid={`reply-btn-${message.id}`}
                >
                    <Reply className="h-3 w-3 md:h-4 md:w-4" />
                </Button>
            </div>
        </motion.div>
    );
}
