import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { MessageCircle, User, Lock, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function AuthPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, register } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (isLogin) {
                await login(username, password);
                toast.success('خوش آمدید!');
            } else {
                await register(username, password, displayName);
                toast.success('ثبت‌نام موفق! خوش آمدید!');
            }
            navigate('/chat');
        } catch (error) {
            toast.error(error.response?.data?.detail || 'خطایی رخ داد');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-split" dir="rtl">
            {/* Art Side */}
            <div className="auth-art relative hidden md:flex items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700">
                <div className="absolute inset-0 opacity-20">
                    <img
                        src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop"
                        alt="Abstract"
                        className="w-full h-full object-cover"
                    />
                </div>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="relative z-10 text-center text-white p-8"
                >
                    <MessageCircle className="w-20 h-20 mx-auto mb-6" />
                    <h1 className="font-heading text-4xl font-bold mb-4">پیامرسان خصوصی</h1>
                    <p className="text-lg text-white/80 max-w-sm mx-auto">
                        گفتگوی امن و خصوصی با عزیزانتان
                    </p>
                </motion.div>
            </div>

            {/* Form Side */}
            <div className="flex items-center justify-center p-8 bg-background">
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5 }}
                    className="w-full max-w-md"
                >
                    <Card className="border-none shadow-2xl shadow-primary/5">
                        <CardHeader className="space-y-1 text-center pb-8">
                            <div className="mx-auto w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                                <MessageCircle className="w-7 h-7 text-primary" />
                            </div>
                            <CardTitle className="font-heading text-2xl">
                                {isLogin ? 'ورود به حساب' : 'ایجاد حساب جدید'}
                            </CardTitle>
                            <CardDescription>
                                {isLogin ? 'برای ادامه وارد شوید' : 'برای شروع ثبت‌نام کنید'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {!isLogin && (
                                    <div className="space-y-2">
                                        <Label htmlFor="displayName">نام نمایشی</Label>
                                        <div className="relative">
                                            <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <Input
                                                id="displayName"
                                                data-testid="display-name-input"
                                                placeholder="نام شما"
                                                value={displayName}
                                                onChange={(e) => setDisplayName(e.target.value)}
                                                className="pr-10"
                                                required={!isLogin}
                                            />
                                        </div>
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <Label htmlFor="username">نام کاربری</Label>
                                    <div className="relative">
                                        <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input
                                            id="username"
                                            data-testid="username-input"
                                            placeholder="نام کاربری"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            className="pr-10"
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="password">رمز عبور</Label>
                                    <div className="relative">
                                        <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input
                                            id="password"
                                            data-testid="password-input"
                                            type="password"
                                            placeholder="رمز عبور"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="pr-10"
                                            required
                                        />
                                    </div>
                                </div>
                                <Button
                                    type="submit"
                                    data-testid="auth-submit-btn"
                                    className="w-full rounded-xl h-12 text-base font-medium"
                                    disabled={loading}
                                >
                                    {loading ? 'لطفاً صبر کنید...' : isLogin ? 'ورود' : 'ثبت‌نام'}
                                </Button>
                            </form>
                            <div className="mt-6 text-center">
                                <button
                                    onClick={() => setIsLogin(!isLogin)}
                                    data-testid="toggle-auth-mode"
                                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                                >
                                    {isLogin ? (
                                        <>حساب ندارید؟ <span className="text-primary font-medium">ثبت‌نام کنید</span></>
                                    ) : (
                                        <>حساب دارید؟ <span className="text-primary font-medium">وارد شوید</span></>
                                    )}
                                </button>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </div>
    );
}
