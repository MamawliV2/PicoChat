#!/bin/bash

#╔════════════════════════════════════════════════════════════════════════════╗
#║                         🗨️ PicoChat Installer                              ║
#║                    نصب خودکار پیامرسان خصوصی PicoChat                      ║
#╚════════════════════════════════════════════════════════════════════════════╝

set -e

# رنگ‌ها
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# متغیرهای پیش‌فرض
INSTALL_DIR="/opt/picochat"
BACKEND_PORT=8001
FRONTEND_PORT=3000

# توابع کمکی
print_banner() {
    echo -e "${CYAN}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║                                                                ║"
    echo "║     🗨️  PicoChat - پیامرسان خصوصی                              ║"
    echo "║                                                                ║"
    echo "║     نسخه: 1.0.0                                                ║"
    echo "║     توسعه‌دهنده: MamawliV2                                     ║"
    echo "║                                                                ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_step() {
    echo -e "\n${BLUE}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✔ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✖ $1${NC}"
}

print_info() {
    echo -e "${PURPLE}ℹ $1${NC}"
}

# بررسی root بودن
check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "این اسکریپت باید با دسترسی root اجرا شود!"
        print_info "لطفاً با sudo اجرا کنید: sudo ./install.sh"
        exit 1
    fi
}

# تشخیص سیستم‌عامل
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$NAME
        OS_ID=$ID
        OS_VERSION=$VERSION_ID
    else
        print_error "سیستم‌عامل پشتیبانی نمی‌شود!"
        exit 1
    fi
    print_info "سیستم‌عامل: $OS $OS_VERSION"
}

# بررسی پیش‌نیازها
check_dependencies() {
    print_step "بررسی پیش‌نیازها..."
    
    local missing=()
    
    # بررسی curl
    if ! command -v curl &> /dev/null; then
        missing+=("curl")
    fi
    
    # بررسی git
    if ! command -v git &> /dev/null; then
        missing+=("git")
    fi
    
    if [ ${#missing[@]} -ne 0 ]; then
        print_warning "نصب پیش‌نیازهای اولیه: ${missing[*]}"
        apt-get update -qq
        apt-get install -y -qq "${missing[@]}"
    fi
    
    print_success "پیش‌نیازهای اولیه بررسی شد"
}

# نصب Python
install_python() {
    print_step "بررسی Python..."
    
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
        print_success "Python $PYTHON_VERSION موجود است"
    else
        print_warning "نصب Python 3..."
        apt-get update -qq
        apt-get install -y -qq python3 python3-pip
    fi
    
    # نصب python3-venv (الزامی برای محیط مجازی)
    print_info "نصب python3-venv..."
    apt-get install -y -qq python3-venv python3-dev
}

# نصب Node.js
install_nodejs() {
    print_step "بررسی Node.js..."
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_success "Node.js $NODE_VERSION موجود است"
    else
        print_warning "نصب Node.js 18..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y -qq nodejs
    fi
    
    # نصب yarn
    if ! command -v yarn &> /dev/null; then
        npm install -g yarn --silent
    fi
}

# نصب MongoDB
install_mongodb() {
    print_step "بررسی MongoDB..."
    
    if command -v mongod &> /dev/null; then
        print_success "MongoDB موجود است"
    else
        print_warning "نصب MongoDB..."
        
        # کلید GPG
        curl -fsSL https://pgp.mongodb.com/server-6.0.asc | \
            gpg -o /usr/share/keyrings/mongodb-server-6.0.gpg --dearmor
        
        # اضافه کردن repo
        echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-6.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | \
            tee /etc/apt/sources.list.d/mongodb-org-6.0.list
        
        apt-get update -qq
        apt-get install -y -qq mongodb-org
        
        systemctl start mongod
        systemctl enable mongod
        
        print_success "MongoDB نصب شد"
    fi
}

# نصب Nginx
install_nginx() {
    print_step "بررسی Nginx..."
    
    if command -v nginx &> /dev/null; then
        print_success "Nginx موجود است"
    else
        print_warning "نصب Nginx..."
        apt-get install -y -qq nginx
        systemctl start nginx
        systemctl enable nginx
        print_success "Nginx نصب شد"
    fi
}

# نصب Certbot
install_certbot() {
    print_step "بررسی Certbot..."
    
    if command -v certbot &> /dev/null; then
        print_success "Certbot موجود است"
    else
        print_warning "نصب Certbot..."
        apt-get install -y -qq certbot python3-certbot-nginx
        print_success "Certbot نصب شد"
    fi
}

# دریافت اطلاعات از کاربر
get_user_input() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}                    تنظیمات PicoChat                          ${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    
    # مسیر نصب
    read -p "$(echo -e ${YELLOW}"مسیر نصب [$INSTALL_DIR]: "${NC})" input
    INSTALL_DIR=${input:-$INSTALL_DIR}
    
    # پورت Backend
    read -p "$(echo -e ${YELLOW}"پورت Backend [$BACKEND_PORT]: "${NC})" input
    BACKEND_PORT=${input:-$BACKEND_PORT}
    
    # پورت Frontend
    read -p "$(echo -e ${YELLOW}"پورت Frontend [$FRONTEND_PORT]: "${NC})" input
    FRONTEND_PORT=${input:-$FRONTEND_PORT}
    
    # JWT Secret
    DEFAULT_SECRET=$(openssl rand -hex 32)
    read -p "$(echo -e ${YELLOW}"JWT Secret [خودکار]: "${NC})" input
    JWT_SECRET=${input:-$DEFAULT_SECRET}
    
    # نام دیتابیس
    read -p "$(echo -e ${YELLOW}"نام دیتابیس [picochat]: "${NC})" input
    DB_NAME=${input:-"picochat"}
    
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}                    تنظیمات دامنه و SSL                        ${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    
    # دامنه
    read -p "$(echo -e ${YELLOW}"آیا دامنه دارید؟ (y/n) [n]: "${NC})" HAS_DOMAIN
    HAS_DOMAIN=${HAS_DOMAIN:-"n"}
    
    if [[ "$HAS_DOMAIN" =~ ^[Yy]$ ]]; then
        read -p "$(echo -e ${YELLOW}"دامنه (مثال: chat.example.com): "${NC})" DOMAIN
        
        if [ -z "$DOMAIN" ]; then
            print_error "دامنه نمی‌تواند خالی باشد!"
            exit 1
        fi
        
        read -p "$(echo -e ${YELLOW}"ایمیل برای SSL (Let's Encrypt): "${NC})" SSL_EMAIL
        
        if [ -z "$SSL_EMAIL" ]; then
            print_error "ایمیل برای SSL الزامی است!"
            exit 1
        fi
        
        USE_SSL=true
    else
        USE_SSL=false
        # دریافت IP سرور
        SERVER_IP=$(curl -s ifconfig.me)
        print_info "IP سرور: $SERVER_IP"
    fi
    
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}                      خلاصه تنظیمات                            ${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  📁 مسیر نصب:      ${GREEN}$INSTALL_DIR${NC}"
    echo -e "  🔌 پورت Backend:  ${GREEN}$BACKEND_PORT${NC}"
    echo -e "  🔌 پورت Frontend: ${GREEN}$FRONTEND_PORT${NC}"
    echo -e "  🗄️  دیتابیس:       ${GREEN}$DB_NAME${NC}"
    if [ "$USE_SSL" = true ]; then
        echo -e "  🌐 دامنه:         ${GREEN}$DOMAIN${NC}"
        echo -e "  🔒 SSL:           ${GREEN}فعال${NC}"
    else
        echo -e "  🌐 آدرس:          ${GREEN}http://$SERVER_IP:$FRONTEND_PORT${NC}"
        echo -e "  🔒 SSL:           ${YELLOW}غیرفعال${NC}"
    fi
    echo ""
    
    read -p "$(echo -e ${YELLOW}"آیا تنظیمات صحیح است؟ (y/n) [y]: "${NC})" CONFIRM
    CONFIRM=${CONFIRM:-"y"}
    
    if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
        print_warning "نصب لغو شد."
        exit 0
    fi
}

# کلون یا دانلود پروژه
clone_project() {
    print_step "دانلود PicoChat..."
    
    # حذف دایرکتوری قبلی اگر وجود داشت
    if [ -d "$INSTALL_DIR" ]; then
        print_warning "دایرکتوری قبلی پاک می‌شود..."
        rm -rf "$INSTALL_DIR"
    fi
    
    # کلون از گیت‌هاب
    git clone https://github.com/MamawliV2/PicoChat.git "$INSTALL_DIR"
    
    if [ ! -d "$INSTALL_DIR/backend" ] || [ ! -d "$INSTALL_DIR/frontend" ]; then
        print_error "دانلود ناموفق بود!"
        exit 1
    fi
    
    print_success "پروژه دانلود شد"
}

# راه‌اندازی Backend
setup_backend() {
    print_step "راه‌اندازی Backend..."
    
    cd "$INSTALL_DIR/backend"
    
    # ساخت محیط مجازی
    python3 -m venv venv
    source venv/bin/activate
    
    # نصب وابستگی‌ها
    pip install --upgrade pip -q
    pip install -r requirements.txt -q
    
    # ساخت فایل .env
    if [ "$USE_SSL" = true ]; then
        BACKEND_URL="https://$DOMAIN"
    else
        BACKEND_URL="http://$SERVER_IP:$BACKEND_PORT"
    fi
    
    cat > .env << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=$DB_NAME
JWT_SECRET=$JWT_SECRET
CORS_ORIGINS=*
EOF
    
    # ساخت دایرکتوری uploads
    mkdir -p uploads
    
    deactivate
    print_success "Backend راه‌اندازی شد"
}

# راه‌اندازی Frontend
setup_frontend() {
    print_step "راه‌اندازی Frontend..."
    
    cd "$INSTALL_DIR/frontend"
    
    # نصب وابستگی‌ها
    yarn install --silent
    
    # ساخت فایل .env
    if [ "$USE_SSL" = true ]; then
        BACKEND_URL="https://$DOMAIN/api"
    else
        BACKEND_URL="http://$SERVER_IP:$BACKEND_PORT"
    fi
    
    cat > .env << EOF
REACT_APP_BACKEND_URL=$BACKEND_URL
EOF
    
    # ساخت build برای production
    print_info "ساخت نسخه production..."
    yarn build --silent
    
    print_success "Frontend راه‌اندازی شد"
}

# ساخت سرویس systemd برای Backend
create_backend_service() {
    print_step "ساخت سرویس Backend..."
    
    cat > /etc/systemd/system/picochat-backend.service << EOF
[Unit]
Description=PicoChat Backend Service
After=network.target mongodb.service

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR/backend
Environment="PATH=$INSTALL_DIR/backend/venv/bin"
ExecStart=$INSTALL_DIR/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port $BACKEND_PORT
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable picochat-backend
    systemctl start picochat-backend
    
    print_success "سرویس Backend ساخته شد"
}

# ساخت سرویس systemd برای Frontend (با serve)
create_frontend_service() {
    print_step "ساخت سرویس Frontend..."
    
    # نصب serve برای سرو کردن build
    npm install -g serve --silent
    
    cat > /etc/systemd/system/picochat-frontend.service << EOF
[Unit]
Description=PicoChat Frontend Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR/frontend
ExecStart=/usr/bin/serve -s build -l $FRONTEND_PORT
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable picochat-frontend
    systemctl start picochat-frontend
    
    print_success "سرویس Frontend ساخته شد"
}

# تنظیم Nginx با SSL
setup_nginx_ssl() {
    print_step "تنظیم Nginx با SSL..."
    
    # تنظیم اولیه بدون SSL برای certbot
    cat > /etc/nginx/sites-available/picochat << EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    location / {
        proxy_pass http://127.0.0.1:$FRONTEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
    
    location /api {
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
    
    location /ws {
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \$host;
    }
    
    location /uploads {
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
    }
}
EOF
    
    # فعال‌سازی سایت
    ln -sf /etc/nginx/sites-available/picochat /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # تست و ری‌استارت nginx
    nginx -t
    systemctl restart nginx
    
    # دریافت SSL
    print_info "دریافت گواهی SSL از Let's Encrypt..."
    certbot --nginx -d "$DOMAIN" --email "$SSL_EMAIL" --agree-tos --non-interactive --redirect
    
    print_success "Nginx و SSL تنظیم شد"
}

# تنظیم Nginx بدون SSL
setup_nginx_no_ssl() {
    print_step "تنظیم Nginx..."
    
    cat > /etc/nginx/sites-available/picochat << EOF
server {
    listen 80;
    server_name _;
    
    location / {
        proxy_pass http://127.0.0.1:$FRONTEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
    
    location /api {
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
    
    location /ws {
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \$host;
    }
    
    location /uploads {
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
    }
}
EOF
    
    # فعال‌سازی سایت
    ln -sf /etc/nginx/sites-available/picochat /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # تست و ری‌استارت nginx
    nginx -t
    systemctl restart nginx
    
    print_success "Nginx تنظیم شد"
}

# تنظیم فایروال
setup_firewall() {
    print_step "تنظیم فایروال..."
    
    if command -v ufw &> /dev/null; then
        ufw allow 80/tcp
        ufw allow 443/tcp
        ufw allow $BACKEND_PORT/tcp
        ufw allow $FRONTEND_PORT/tcp
        print_success "فایروال تنظیم شد"
    else
        print_warning "UFW یافت نشد، فایروال تنظیم نشد"
    fi
}

# نمایش اطلاعات نهایی
show_completion() {
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                                ║${NC}"
    echo -e "${GREEN}║     ✅ PicoChat با موفقیت نصب شد!                              ║${NC}"
    echo -e "${GREEN}║                                                                ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${CYAN}📍 آدرس دسترسی:${NC}"
    if [ "$USE_SSL" = true ]; then
        echo -e "     🌐 وب‌سایت:    ${GREEN}https://$DOMAIN${NC}"
        echo -e "     🔌 API:        ${GREEN}https://$DOMAIN/api${NC}"
    else
        echo -e "     🌐 وب‌سایت:    ${GREEN}http://$SERVER_IP${NC}"
        echo -e "     🔌 API:        ${GREEN}http://$SERVER_IP:$BACKEND_PORT/api${NC}"
    fi
    echo ""
    echo -e "  ${CYAN}📁 مسیرهای مهم:${NC}"
    echo -e "     • نصب:        $INSTALL_DIR"
    echo -e "     • لاگ‌ها:      journalctl -u picochat-backend -f"
    echo ""
    echo -e "  ${CYAN}🔧 دستورات مدیریت:${NC}"
    echo -e "     • ری‌استارت:  sudo systemctl restart picochat-backend picochat-frontend"
    echo -e "     • وضعیت:      sudo systemctl status picochat-backend"
    echo -e "     • لاگ:        sudo journalctl -u picochat-backend -f"
    echo ""
    echo -e "  ${YELLOW}⚠️  نکات مهم:${NC}"
    echo -e "     • اولین کاربری که ثبت‌نام کند، می‌تواند استفاده کند"
    echo -e "     • JWT_SECRET را در جایی امن ذخیره کنید"
    if [ "$USE_SSL" = false ]; then
        echo -e "     • برای امنیت بیشتر، SSL فعال کنید"
    fi
    echo ""
    echo -e "  ${PURPLE}💡 برای حذف:${NC}"
    echo -e "     sudo systemctl stop picochat-backend picochat-frontend"
    echo -e "     sudo systemctl disable picochat-backend picochat-frontend"
    echo -e "     sudo rm -rf $INSTALL_DIR"
    echo ""
}

# اجرای uninstall
uninstall() {
    print_banner
    print_warning "حذف PicoChat..."
    
    systemctl stop picochat-backend picochat-frontend 2>/dev/null || true
    systemctl disable picochat-backend picochat-frontend 2>/dev/null || true
    rm -f /etc/systemd/system/picochat-backend.service
    rm -f /etc/systemd/system/picochat-frontend.service
    rm -f /etc/nginx/sites-enabled/picochat
    rm -f /etc/nginx/sites-available/picochat
    rm -rf "$INSTALL_DIR"
    systemctl daemon-reload
    systemctl restart nginx 2>/dev/null || true
    
    print_success "PicoChat با موفقیت حذف شد!"
}

# تابع اصلی
main() {
    print_banner
    
    # بررسی آرگومان‌ها
    if [[ "$1" == "--uninstall" ]] || [[ "$1" == "-u" ]]; then
        check_root
        uninstall
        exit 0
    fi
    
    if [[ "$1" == "--help" ]] || [[ "$1" == "-h" ]]; then
        echo "استفاده: ./install.sh [گزینه]"
        echo ""
        echo "گزینه‌ها:"
        echo "  -h, --help       نمایش این راهنما"
        echo "  -u, --uninstall  حذف PicoChat"
        echo ""
        exit 0
    fi
    
    check_root
    detect_os
    check_dependencies
    get_user_input
    
    install_python
    install_nodejs
    install_mongodb
    install_nginx
    
    if [ "$USE_SSL" = true ]; then
        install_certbot
    fi
    
    clone_project
    setup_backend
    setup_frontend
    create_backend_service
    create_frontend_service
    
    if [ "$USE_SSL" = true ]; then
        setup_nginx_ssl
    else
        setup_nginx_no_ssl
    fi
    
    setup_firewall
    show_completion
}

# اجرای برنامه
main "$@"
