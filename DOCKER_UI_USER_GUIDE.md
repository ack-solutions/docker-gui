# Docker GUI - Quick User Guide

## 🎯 What's New?

Your Docker GUI has been significantly improved with better controls, more screen space, and enhanced functionality!

---

## 📱 Bottom Panel (Logs & Terminal)

### Resizing the Panel
**The panel is now fully resizable!**

1. **Find the resize handle** at the top edge of the bottom panel
2. **Hover over it** - you'll see a blue indicator bar
3. **Click and drag** up or down to adjust height
4. Your preferred height is **saved automatically**!

**Pro Tips:**
- Drag all the way up for maximum viewing space
- Double-click the minimize button to quickly hide/show
- The panel remembers your size preference between sessions

---

## 📋 Log Viewer

### New Features

#### 1. **Collapsible Filters** 🎛️
- Click the **arrow icon** (▼/▲) to show/hide search and filter controls
- Saves space while keeping logs visible
- Essential counters always stay visible

#### 2. **Quick Copy Logs** 📋
- Click the **copy icon** to instantly copy all visible logs
- No need to manually select text!
- Works with your system clipboard (Ctrl+V to paste)

#### 3. **Download Logs** 💾
- Click the **download icon** to save logs as a text file
- Includes timestamps and log levels
- Great for sharing with team members

#### 4. **Smart Counters** 📊
- See **warnings (⚠)** and **errors (✕)** at a glance
- Color-coded chips for quick scanning
- Shows total vs filtered count

### How to Use

**Search logs:**
1. Click the expand filters icon (▼)
2. Type in the search box
3. Results update instantly

**Filter by level:**
1. Expand filters
2. Select: All, Info, Warn, or Error
3. View only what matters

**Stream logs:**
- Click **play icon** (▶) to start live streaming
- Click **pause icon** (⏸) to stop
- Logs auto-update in real-time

---

## 💻 Terminal

### New Features

#### 1. **Copy All Output** 📋
- Floating **copy button** in top-right corner
- Copies entire terminal history
- Includes all command outputs

#### 2. **Clear Terminal** 🧹
- Click the **sweep icon** to clear all output
- Starts fresh without closing the session
- Or type `clear` command

#### 3. **Better Commands** ⌨️
- Press **Enter** to execute
- Use **↑** and **↓** for command history
- **Ctrl+C** to cancel running command
- Errors shown in **red** for visibility

### Common Commands

```bash
# List files
ls -la

# Check environment variables
env

# See running processes
ps aux

# Check disk space
df -h

# View file contents
cat /path/to/file

# Clear screen
clear
```

---

## 🎨 Compact Toolbar

### What Changed?

**Smaller, smarter controls:**
- Counter chips are more compact (24-28px)
- Icons have tooltips - hover to see what they do
- Search bar is appropriately sized
- Grid/List view toggle more accessible

**Quick Actions:**
- **Search**: Find containers instantly
- **+ New**: Create container
- **Maintenance menu**: Prune and cleanup
- **View switcher**: Toggle grid/list display

---

## 🚨 Error Messages

### Better Feedback!

**You'll now see:**
- ✅ **Toast notifications** for all actions (bottom-right)
- ✅ **Clear error messages** when something fails
- ✅ **Retry buttons** on error screens
- ✅ **Loading spinners** during operations
- ✅ **Docker connection status** messages

### Common Messages

| Message | Meaning | Action |
|---------|---------|--------|
| "Logs copied to clipboard" | ✅ Success! | Paste anywhere |
| "Failed to connect to Docker" | ❌ Docker not running | Start Docker daemon |
| "Container is stopped" | ⚠️ Warning | Start the container first |
| "Command executed" | ✅ Terminal success | Check output |
| "Operation timeout" | ❌ Took too long | Try again or check Docker |

---

## ⌨️ Keyboard Shortcuts

### Terminal
- **Enter**: Execute command
- **↑/↓**: Navigate command history
- **Ctrl+C**: Cancel current operation
- Type **clear**: Clear terminal

### General
- **Ctrl+C**: Copy selected text (system)
- **Ctrl+V**: Paste (system)
- **Tab**: Move between fields

---

## 🎯 Pro Tips

### 1. **Maximize Log Space**
- Collapse filters when not needed
- Resize bottom panel to your preference
- Use expand button (⛶) for full-screen logs

### 2. **Efficient Log Viewing**
- Use log level filters to reduce noise
- Search for specific errors or patterns
- Download logs for external analysis

### 3. **Terminal Productivity**
- Use ↑/↓ to repeat previous commands
- Run multiple commands in sequence
- Copy output for documentation

### 4. **Container Management**
- Search by name, ID, or status
- Use maintenance menu for cleanup
- Monitor resource usage in real-time

---

## 🔧 Troubleshooting

### "Nothing is happening"
- Check if Docker daemon is running
- Look for error messages in toasts (bottom-right)
- Open browser console (F12) for details

### "Can't resize panel"
- Make sure you're dragging the top edge
- Look for the blue resize indicator
- Try refreshing the page

### "Logs not loading"
- Verify container is running
- Check Docker connection
- Click retry button if available

### "Terminal not responding"
- Check if container is stopped
- Try refreshing the page
- Verify Docker daemon connectivity

---

## 📱 Mobile Usage

**The interface is fully responsive!**

- Touch-friendly buttons
- Swipe to scroll logs/terminal
- Optimized layouts for small screens
- All features work on mobile

---

## 🎊 Enjoy Your Improved Docker GUI!

**Key Improvements:**
- ✅ More screen space for content
- ✅ Better control over panels
- ✅ Faster log copying and downloading
- ✅ Clearer error messages
- ✅ Smoother, more responsive UI

**Questions or Issues?**
- Check browser console (F12)
- Verify Docker is running
- Clear browser cache if needed
- Review error toasts for details

---

**Happy Docker Managing! 🐳**
