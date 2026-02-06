import requests
import sys
import json
from datetime import datetime

class PrivateMessengerAPITester:
    def __init__(self, base_url="https://private-chat-py.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            
            if success:
                self.log_test(name, True)
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                error_msg = f"Expected {expected_status}, got {response.status_code}"
                try:
                    error_detail = response.json().get('detail', '')
                    if error_detail:
                        error_msg += f" - {error_detail}"
                except:
                    pass
                self.log_test(name, False, error_msg)
                return False, {}

        except requests.exceptions.RequestException as e:
            self.log_test(name, False, f"Request error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        return self.run_test("Root API", "GET", "", 200)

    def test_register_user(self, username, password, display_name):
        """Test user registration"""
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data={
                "username": username,
                "password": password,
                "display_name": display_name
            }
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            print(f"   Registered user ID: {self.user_id}")
            return True
        return False

    def test_login_user(self, username, password):
        """Test user login"""
        success, response = self.run_test(
            "User Login",
            "POST", 
            "auth/login",
            200,
            data={
                "username": username,
                "password": password
            }
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            print(f"   Logged in user ID: {self.user_id}")
            return True
        return False

    def test_get_current_user(self):
        """Test get current user"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        return success

    def test_get_users(self):
        """Test get all users"""
        success, response = self.run_test(
            "Get All Users",
            "GET",
            "users",
            200
        )
        return success, response

    def test_create_conversation(self, other_user_id):
        """Test create/get conversation"""
        success, response = self.run_test(
            "Create/Get Conversation",
            "POST",
            f"conversations/{other_user_id}",
            200
        )
        
        if success and 'id' in response:
            print(f"   Conversation ID: {response['id']}")
            return True, response['id']
        return False, None

    def test_send_message(self, conversation_id, content):
        """Test send message"""
        success, response = self.run_test(
            "Send Message",
            "POST",
            f"messages/{conversation_id}",
            200,
            data={
                "content": content,
                "type": "text"
            }
        )
        
        if success and 'id' in response:
            print(f"   Message ID: {response['id']}")
            return True, response['id']
        return False, None

    def test_get_messages(self, conversation_id):
        """Test get messages"""
        success, response = self.run_test(
            "Get Messages",
            "GET",
            f"messages/{conversation_id}",
            200
        )
        return success, response

    def test_send_reply_message(self, conversation_id, content, reply_to_id):
        """Test send reply message"""
        success, response = self.run_test(
            "Send Reply Message",
            "POST",
            f"messages/{conversation_id}",
            200,
            data={
                "content": content,
                "type": "text",
                "reply_to": reply_to_id
            }
        )
        return success

    def test_logout(self):
        """Test logout"""
        success, response = self.run_test(
            "User Logout",
            "POST",
            "auth/logout",
            200
        )
        return success

    def print_summary(self):
        """Print test summary"""
        print(f"\n{'='*50}")
        print(f"📊 TEST SUMMARY")
        print(f"{'='*50}")
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.tests_run - self.tests_passed > 0:
            print(f"\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"   - {result['test']}: {result['details']}")
        
        return self.tests_passed == self.tests_run

def main():
    print("🚀 Starting Private Messenger API Tests")
    print("="*50)
    
    tester = PrivateMessengerAPITester()
    
    # Test basic connectivity
    success, _ = tester.test_root_endpoint()
    if not success:
        print("❌ Cannot connect to API. Stopping tests.")
        return 1
    
    # Create test users
    timestamp = datetime.now().strftime('%H%M%S')
    user1_username = f"testuser1_{timestamp}"
    user2_username = f"testuser2_{timestamp}"
    password = "TestPass123!"
    
    # Test user registration
    if not tester.test_register_user(user1_username, password, "کاربر تست ۱"):
        print("❌ User registration failed. Stopping tests.")
        return 1
    
    # Test get current user
    tester.test_get_current_user()
    
    # Store first user token
    user1_token = tester.token
    user1_id = tester.user_id
    
    # Register second user
    tester.token = None  # Clear token to register new user
    if not tester.test_register_user(user2_username, password, "کاربر تست ۲"):
        print("❌ Second user registration failed.")
        return 1
    
    user2_id = tester.user_id
    
    # Test get users list
    success, users_data = tester.test_get_users()
    if success:
        print(f"   Found {len(users_data)} users")
    
    # Test conversation creation
    success, conv_id = tester.test_create_conversation(user1_id)
    if not success:
        print("❌ Conversation creation failed.")
        return 1
    
    # Test sending messages
    success, msg_id = tester.test_send_message(conv_id, "سلام! این پیام تست است.")
    if not success:
        print("❌ Message sending failed.")
        return 1
    
    # Test getting messages
    success, messages = tester.test_get_messages(conv_id)
    if success:
        print(f"   Retrieved {len(messages)} messages")
    
    # Test reply message
    if msg_id:
        tester.test_send_reply_message(conv_id, "این پاسخ به پیام قبلی است.", msg_id)
    
    # Test login with first user
    tester.token = None
    tester.test_login_user(user1_username, password)
    
    # Test logout
    tester.test_logout()
    
    # Print final summary
    all_passed = tester.print_summary()
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())