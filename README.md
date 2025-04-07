# ⚙️ X-Clone Backend API

Node.js/Express server handling authentication, post management, and file uploads to AWS S3.  
**API Base URL**: `https://api.x-clone.app` *(Access restricted to frontend only)*  

## 🔧 Core Services
| Service          | Technology          | Purpose                          |
|------------------|---------------------|----------------------------------|
| Runtime          | Node.js 18 (LTS)    | JavaScript execution             |
| Framework        | Express.js          | API routing                      |
| Database         | MongoDB Atlas       | NoSQL data storage               |
| Object Storage   | AWS S3              | User uploads (images/videos)     |
| Authentication   | JWT                 | Secure user sessions             |
| Deployment       | Render              | Cloud hosting                    |

## 🏗️ Infrastructure
```mermaid
graph LR
  A[Frontend] --> B[Backend API]
  B --> C[MongoDB Atlas]
  B --> D[AWS S3]
  B --> E[Redis Cache] <!-- Optional -->


## 📂 Critical File Structure
```plaintext
src/
├── config/         # Environment setup
│   ├── aws.js      # S3 client configuration
│   └── database.js # MongoDB connection
├── controllers/    # Business logic
│   ├── upload.js   # S3 file handling
│   └── auth.js     # JWT authentication
├── routes/         # API endpoints
│   ├── media.js    # Upload routes
│   └── posts.js    # Content routes
├── middleware/     # Auth & validation
└── app.js          # Server entry point
