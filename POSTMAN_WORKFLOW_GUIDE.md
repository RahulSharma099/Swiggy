# Postman Workflow Testing Guide

## 📋 Overview

This guide explains how to use the Postman workflow collection for comprehensive API testing of the Swiggy project. The workflow simulates a complete user journey through the entire system.

## 🎯 What The Workflow Tests

The workflow is organized into 5 main sections:

### 1️⃣ **Setup & Health Check**
- Verifies the API is running and responsive
- Initializes environment variables

### 2️⃣ **Workspace Management**
- Create a workspace
- Retrieve all workspaces
- Get specific workspace by ID
- Update workspace details

### 3️⃣ **Project Management**
- Create a project within workspace
- List all projects in workspace
- Get project details
- Update project information

### 4️⃣ **Issue Management** (Most Complex)
- Create multiple issues (3 different types: bug, feature, task)
- List all issues in project
- Get individual issue details
- Update issue status (open → in-progress → closed)
- Delete an issue

### 5️⃣ **Search & Validation**
- Search for issues by text
- Final workflow validation

---

## 🚀 Quick Start

### **Step 1: Import Collection into Postman**

1. Download the workflow file: `postman_workflow.json`
2. Open **Postman**
3. Click **File** → **Import**
4. Select the `postman_workflow.json` file
5. Click **Import**

### **Step 2: Set Up Environment**

You can use the **default environment** or create a custom one:

**Default Variables (already set in collection):**
- `baseUrl`: `http://localhost:3000` ← Change if needed
- `workspaceId`: Auto-populated during workflow
- `projectId`: Auto-populated during workflow
- `issueId1`, `issueId2`, `issueId3`: Auto-populated during workflow

**To use a custom environment:**
1. Click **Environments** (left sidebar)
2. Click **Create New**
3. Add these variables:

```json
{
  "baseUrl": {
    "enabled": true,
    "value": "http://localhost:3001/api"
  }
}
```

### **Step 3: Start Your API Server**

Make sure your API is running:

```bash
# From Swiggy root
cd packages/api
npm run dev
# or
npm run build && node dist/server.js
```

API should be available at: `http://localhost:3001/api`

---

## 🎮 Run The Workflow

### **Option 1: Run Full Collection (Sequential)**

1. In Postman, select the imported collection
2. Click the **Run** button (▶️)
3. Select all requests in the **Collection Runner**
4. Click **Run Collection**
5. Watch the requests execute in sequence
6. Check results in the **Run Summary**

### **Option 2: Run Individual Folders**

1. Right-click on a folder (e.g., "1️⃣ Workspace Management")
2. Click **Run Folder**
3. Execute just that section

### **Option 3: Manual Request Execution**

1. Click on any request in the collection
2. Review the request details
3. Click **Send**
4. Check the response

---

## 📊 Understanding Test Results

Each request includes **pre-request scripts** and **test scripts**:

### **Pre-request Scripts** (Run Before Request)
- Set up dynamic data (timestamps, unique names)
- Prepare request body

### **Test Scripts** (Run After Response)
- Validate status codes (200, 201, etc.)
- Check response structure
- Extract IDs for use in subsequent requests
- Print confirmation logs

### **Example: Create Workspace Test**
```javascript
pm.test('Create workspace - status is 201', function () {
  pm.response.to.have.status(201);
});

pm.test('Create workspace - save workspace ID', function () {
  const jsonData = pm.response.json();
  const workspaceId = jsonData.data.id;
  pm.expect(workspaceId).to.be.ok;
  pm.environment.set('workspaceId', workspaceId);
  console.log('[✓] Workspace created: ' + workspaceId);
});
```

---

## 📈 Complete Workflow Example

Here's what happens when you run the full collection:

```
1. Health Check API
   ✓ Response: 200 OK, {"status": "ok"}
   
2. Create Workspace
   ✓ Response: 201 Created, {data: {id: "ws-123", name: "Workspace-123456"}}
   → Saves workspaceId: "ws-123" to environment
   
3. Get Workspaces
   ✓ Response: 200 OK, list includes ws-123
   
4. Get Workspace by ID
   ✓ Response: 200 OK, {data: {id: "ws-123"}}
   
5. Update Workspace
   ✓ Response: 200 OK, name updated
   
6. Create Project
   ✓ Response: 201 Created, {data: {id: "proj-456"}}
   → Saves projectId: "proj-456" to environment
   
7. Get Projects in Workspace
   ✓ Response: 200 OK, list includes proj-456
   
8. Create Issue #1 (Bug)
   ✓ Response: 201 Created, {data: {id: "issue-001"}}
   → Saves issueId1: "issue-001" to environment
   
9. Create Issue #2 (Feature)
   ✓ Response: 201 Created, {data: {id: "issue-002"}}
   → Saves issueId2: "issue-002" to environment
   
10. Create Issue #3 (Task)
    ✓ Response: 201 Created, {data: {id: "issue-003"}}
    → Saves issueId3: "issue-003" to environment
    
11. Get All Issues
    ✓ Response: 200 OK, list has 3 issues
    
12. Update Issue (in-progress)
    ✓ Response: 200 OK, status: "in-progress"
    
13. Update Issue (closed)
    ✓ Response: 200 OK, status: "closed"
    
14. Delete Issue
    ✓ Response: 204 No Content
    
15. Search Issues
    ✓ Response: 200 OK, results include search matches
    
16. Final Validation
    ✓ All IDs captured and validated
    ✓ WORKFLOW COMPLETED SUCCESSFULLY
```

---

## 🔍 Viewing Console Logs

When running the workflow, you'll see detailed logs in the **Console**:

1. Click **View** → **Show Postman Console** (bottom-left)
2. Watch logs as requests execute:

```
[Setup] Initialized environment variables
[Setup] Workspace name: Workspace-1724000000
[✓] Workspace created: ws-abc123
[✓] Project created: proj-def456
[✓] Issue #1 created: issue-001
[✓] Issue #2 created: issue-002
[✓] Issue #3 created: issue-003

═══════════════════════════════════════════
✓ WORKFLOW TEST COMPLETED SUCCESSFULLY
═══════════════════════════════════════════
Workspace ID: ws-abc123
Project ID:  proj-def456
Issue ID #1: issue-001
Issue ID #2: issue-002
═══════════════════════════════════════════
```

---

## 🛠️ Customizing The Workflow

### **Change API Base URL**

1. Click **Environments**
2. Select your environment
3. Update `baseUrl` variable:
   - Development: `http://localhost:3001/api`
   - Staging: `https://api-staging.example.com`
   - Production: `https://api.example.com`

### **Modify Request Body**

1. Open any request
2. Click **Body** tab
3. Edit the JSON
4. Example - Change workspace name:

```json
{
  "name": "My Custom Workspace Name",
  "description": "Custom description"
}
```

### **Add New Tests**

Click on any request → **Tests** tab → Add assertions:

```javascript
pm.test('Custom test', function () {
  pm.response.to.have.status(200);
  pm.expect(pm.response.json().data).to.have.property('createdAt');
});
```

---

## 🐛 Troubleshooting

### **Request Fails with 404**

**Problem:** Endpoint not found
**Solutions:**
- Verify API is running: `npm run dev`
- Check `baseUrl` is correct
- Verify endpoint path in request

### **Request Fails with 400**

**Problem:** Invalid request body
**Solutions:**
- Check required fields are present
- Validate JSON syntax
- Check data types (string vs number)

### **IDs Not Being Saved**

**Problem:** Environment variables empty
**Solutions:**
- Check test script for `pm.environment.set()`
- Look at console for errors
- Run requests sequentially (use Collection Runner)

### **Tests Fail with Timeout**

**Problem:** API too slow
**Solutions:**
- Increase request timeout: Click request → **Settings**
- Set timeout to 30000ms (30 seconds)
- Check API server is responsive

---

## 📊 Using Postman Flows (New Feature)

Postman's **Flows** feature provides visual workflow execution:

1. Click **Flows** (top menu)
2. Click **Create** → **New Flow**
3. Drag collection requests into the flow canvas
4. Connect requests with arrows
5. Add conditional logic if needed
6. Click **Run** to execute

This gives a visual representation of your workflow.

---

## 🧪 Advanced Testing Scenarios

### **Scenario 1: Rapid Issue Creation**

Create 10 issues quickly to test concurrent operations:

```javascript
// In pre-request script
for (let i = 0; i < 10; i++) {
  // Create issue request repeated 10x
}
```

### **Scenario 2: Error Handling**

Test invalid inputs:

```javascript
// Invalid workspace (empty name)
{
  "name": "",
  "description": "Should fail"
}
```

### **Scenario 3: Update State Machine**

Test issue status transitions:
- open → in-progress → review → closed

---

## 📝 Collection Structure Reference

```
Swiggy API - Complete Workflow
├── Setup & Health Check
│   └── Health Check
├── 1️⃣ Workspace Management
│   ├── Create Workspace
│   ├── Get All Workspaces
│   ├── Get Workspace by ID
│   └── Update Workspace
├── 2️⃣ Project Management
│   ├── Create Project
│   ├── Get Projects in Workspace
│   ├── Get Project by ID
│   └── Update Project
├── 3️⃣ Issue Management
│   ├── Create Issue #1
│   ├── Create Issue #2
│   ├── Create Issue #3
│   ├── Get All Issues in Project
│   ├── Get Issue by ID
│   ├── Update Issue (Change Status)
│   ├── Update Issue (Mark as Closed)
│   └── Delete Issue
├── 4️⃣ Search & Data Retrieval
│   └── Search Issues (Text Search)
└── 5️⃣ Workflow Summary & Validation
    └── Validation - Final State Check
```

---

## 📚 Additional Resources

- **Postman Documentation**: https://learning.postman.com/
- **Collection Format**: https://schema.getpostman.com/
- **Test Scripting**: https://learning.postman.com/docs/writing-scripts/

---

## 💡 Tips & Tricks

1. **Save Environment After Running**: Data persists for next run
2. **Use Pre-request Scripts**: Dynamically generate test data
3. **Chain Requests**: Use `pm.environment.set()` to chain requests
4. **Parallel Execution**: Use flows for visual debugging
5. **Export Results**: Collection Runner shows pass/fail summary

---

## 🎓 Next Steps

1. ✅ Import the collection
2. ✅ Set up your environment
3. ✅ Start your API server
4. ✅ Run the complete workflow
5. ✅ Check the console logs
6. ✅ Verify all tests pass
7. ✅ Customize for your needs

Happy testing! 🚀
