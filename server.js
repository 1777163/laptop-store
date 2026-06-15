/**
 * PetCreative 平台服务器 v2.0
 * ── 支持跨设备数据同步 ──
 *
 * 用法: node server.js
 * 默认端口: 3000，可通过 PORT 环境变量修改
 *
 * API 端点:
 *   POST /api/register    — 注册新用户
 *   POST /api/login       — 登录验证
 *   POST /api/sync        — 推送/拉取数据
 *
 * 数据存储: data/ 目录下的 JSON 文件
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const USERDATA_DIR = path.join(DATA_DIR, 'userdata');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

// ── 确保数据目录存在 ──
[DATA_DIR, USERDATA_DIR, BACKUP_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ── 获取局域网 IP ──
function getLANIPs() {
  const ifaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

// ── MIME 类型 ──
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.webmanifest': 'application/manifest+json',
};

// ── 安全响应头 ──
const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self'; frame-ancestors 'none'; frame-src 'none'; child-src 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; manifest-src 'self'; media-src 'self' blob:;",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self), payment=()',
  'Cache-Control': 'no-cache, must-revalidate',
};

// ── 请求限流 ──
const rateLimitMap = new Map();
const RATE_LIMIT = 60;
const RATE_WINDOW = 60000;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_WINDOW) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return true;
  }
  entry.count++;
  if (entry.count > RATE_LIMIT) return false;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now - entry.windowStart > RATE_WINDOW) rateLimitMap.delete(ip);
  }
}, 300000);

// ── 密码哈希 (客户端已做 SHA-256，服务端直接存储和比对) ──
// 客户端使用 crypto.subtle.digest('SHA-256', password + PASSWORD_SALT) 生成哈希
// 服务端直接比较客户端传来的 passwordHash
// WARNING: 生产环境请使用环境变量 PASSWORD_SALT
const PASSWORD_SALT = process.env.PASSWORD_SALT || 'pc_demo_local_salt_2026';

function hashServerPassword(password) {
  // 与客户端保持一致的哈希算法 (带 'h_' 前缀)
  return 'h_' + crypto.createHash('sha256')
    .update(password + PASSWORD_SALT)
    .digest('hex');
}

// ── 会话令牌 ──
const authTokens = new Map(); // token → { userId, username, expiresAt }

function generateToken(userId, username) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24小时
  authTokens.set(token, { userId, username, expiresAt });
  // 清理过期令牌
  for (const [t, data] of authTokens) {
    if (Date.now() > data.expiresAt) authTokens.delete(t);
  }
  return token;
}

function validateToken(token) {
  const data = authTokens.get(token);
  if (!data) return null;
  if (Date.now() > data.expiresAt) {
    authTokens.delete(token);
    return null;
  }
  // 续期
  data.expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  return data;
}

// ── JSON 文件读写 ──
function readJSON(filePath, defaultValue) {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error(`[ERROR] 读取 ${filePath} 失败:`, e.message);
  }
  return defaultValue;
}

function writeJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error(`[ERROR] 写入 ${filePath} 失败:`, e.message);
    return false;
  }
}

// ── 数据备份 ──
function backupData() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  try {
    if (fs.existsSync(USERS_FILE)) {
      fs.copyFileSync(USERS_FILE, path.join(BACKUP_DIR, `users_${ts}.json`));
    }
    if (fs.existsSync(STATE_FILE)) {
      fs.copyFileSync(STATE_FILE, path.join(BACKUP_DIR, `state_${ts}.json`));
    }
    // 只保留最近 20 个备份
    const backups = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json'));
    if (backups.length > 40) {
      backups.sort();
      for (let i = 0; i < backups.length - 40; i++) {
        fs.unlinkSync(path.join(BACKUP_DIR, backups[i]));
      }
    }
  } catch (e) {
    console.error('[ERROR] 备份失败:', e.message);
  }
}

// ── 加载数据 ──
let users = readJSON(USERS_FILE, []);
let appState = readJSON(STATE_FILE, {
  _version: 0,
  _updatedAt: new Date().toISOString(),
  orders: [],
  afterSalesRequests: [],
  platformSettings: {},
  adminData: { subAccounts: [], withdrawRequests: [], totalWithdrawn: 0 },
  customProducts: [],
  disabledProductIds: [],
  coupons: [],
  feedbacks: [],
});

// ── 启动时初始化数据文件 ──
function initDataFiles() {
  if (!fs.existsSync(USERS_FILE)) {
    writeJSON(USERS_FILE, users);
    console.log('[初始化] 已创建 ' + USERS_FILE);
  }
  if (!fs.existsSync(STATE_FILE)) {
    writeJSON(STATE_FILE, appState);
    console.log('[初始化] 已创建 ' + STATE_FILE);
  }
  
  // 确保管理员账号存在
  initAdminAccount();
}

// ── 确保管理员账号存在 ──
function initAdminAccount() {
  const adminUsername = 'admin';
  let adminUser = users.find(u => u.username === adminUsername || u.role === 'admin');
  
  if (!adminUser) {
    // 创建管理员账号（同时存储明文和哈希）
    const adminHash = hashServerPassword('admin123');
    adminUser = {
      id: 'u_admin_001',
      username: adminUsername,
      nickname: '平台管理员',
      role: 'admin',
      password: 'admin123',
      passwordHash: adminHash,
      permissions: ['shop', 'take', 'design', 'admin', 'after'],
      balance: 0,
      createdAt: new Date().toISOString(),
    };
    users.push(adminUser);
    saveUsers();
    console.log('[初始化] 已创建管理员账号: admin / admin123');
    console.log('[初始化] 管理员密码哈希: ' + adminHash);
  } else {
    // 确保管理员有正确的密码字段和哈希
    if (!adminUser.password) {
      adminUser.password = 'admin123';
    }
    if (!adminUser.passwordHash) {
      adminUser.passwordHash = hashServerPassword('admin123');
    }
    // 验证哈希是否正确
    const expectedHash = hashServerPassword('admin123');
    if (adminUser.passwordHash !== expectedHash) {
      adminUser.passwordHash = expectedHash;
      adminUser.password = 'admin123';
      console.log('[初始化] 管理员密码哈希已修正');
    }
    saveUsers();
    console.log('[初始化] 管理员账号已存在');
  }
}

initDataFiles();

function saveUsers() {
  writeJSON(USERS_FILE, users);
}

function saveState() {
  appState._version = (appState._version || 0) + 1;
  appState._updatedAt = new Date().toISOString();
  writeJSON(STATE_FILE, appState);
}

// 定期备份（每 10 分钟）
setInterval(backupData, 10 * 60 * 1000);

// ── 辅助函数 ──
function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf-8');
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('JSON 解析失败'));
      }
    });
    req.on('error', reject);
  });
}

function sendJSON(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(body);
}

function sendError(res, status, message) {
  sendJSON(res, status, { error: true, message });
}

// ── 获取用户数据文件路径（仅存用户独立数据：余额/购物记录/接单记录）──
function getUserDataPath(userId) {
  return path.join(USERDATA_DIR, `${userId}.json`);
}

function readUserData(userId) {
  return readJSON(getUserDataPath(userId), {});
}

function writeUserData(userId, data) {
  return writeJSON(getUserDataPath(userId), data);
}

// ── API 路由处理 ──
async function handleAPI(req, res, urlPath) {
  // CORS 预检
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return;
  }

  // ── POST /api/register ──
  if (urlPath === '/api/register' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { username, passwordHash, nickname, role, permissions, securityQuestions } = body;

      if (!username || !passwordHash) return sendError(res, 400, '用户名和密码不能为空');
      if (!/^[a-zA-Z0-9]{3,20}$/.test(username)) return sendError(res, 400, '用户名格式不正确');
      if (users.find(u => u.username === username)) return sendError(res, 409, '该用户名已被注册');

      const newUser = {
        id: 'u_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'),
        username,
        passwordHash,
        nickname: nickname || username,
        role: role || 'user',
        permissions: permissions || ['shop'],
        securityQuestions: securityQuestions || [],
        balance: 0,
        createdAt: new Date().toISOString(),
      };

      users.push(newUser);
      saveUsers();
      backupData();

      // 创建用户独立数据（余额/购物记录/接单记录）
      writeUserData(newUser.id, {
        cart: [],
        claimedCouponIds: [],
        myPurchasedOrderIds: [],
        myAcceptedOrderIds: [],
        aiChatHistory: [],
      });

      const token = generateToken(newUser.id, newUser.username);
      console.log(`[注册] 新用户: ${username} (${newUser.nickname})`);

      sendJSON(res, 201, {
        token,
        user: {
          id: newUser.id,
          username: newUser.username,
          nickname: newUser.nickname,
          role: newUser.role,
          permissions: newUser.permissions,
          balance: newUser.balance,
          createdAt: newUser.createdAt,
        },
        appState,
        userData: {
          cart: [],
          claimedCouponIds: [],
          myPurchasedOrderIds: [],
          myAcceptedOrderIds: [],
          aiChatHistory: [],
        },
      });
    } catch (e) {
      sendError(res, 400, e.message);
    }
    return;
  }

  // ── POST /api/login ──
  if (urlPath === '/api/login' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { username, passwordHash, password } = body;

      if (!username) return sendError(res, 400, '用户名不能为空');
      if (!passwordHash && !password) return sendError(res, 400, '密码不能为空');

      const user = users.find(u => u.username === username);
      if (!user) return sendError(res, 401, '用户名或密码错误');

      // 验证密码（兼容 passwordHash 和明文 password）
      let passwordValid = false;
      if (passwordHash && user.passwordHash === passwordHash) {
        passwordValid = true;
      } else if (password && user.password === password) {
        passwordValid = true;
        // 如果用户有明文密码但没有哈希，同步存储哈希
        if (!user.passwordHash) {
          user.passwordHash = hashServerPassword(password);
          saveUsers();
        }
      }
      
      if (!passwordValid) {
        return sendError(res, 401, '用户名或密码错误');
      }

      const token = generateToken(user.id, user.username);
      const userData = readUserData(user.id);

      console.log(`[登录] ${username} 登录成功`);

      sendJSON(res, 200, {
        token,
        user: {
          id: user.id,
          username: user.username,
          nickname: user.nickname,
          role: user.role,
          permissions: user.permissions,
          securityQuestions: user.securityQuestions,
          balance: user.balance,
          createdAt: user.createdAt,
        },
        appState,
        userData: userData || {
          cart: [],
          claimedCouponIds: [],
          myPurchasedOrderIds: [],
          myAcceptedOrderIds: [],
          aiChatHistory: [],
        },
      });
    } catch (e) {
      sendError(res, 400, e.message);
    }
    return;
  }

  // ── POST /api/sync ── 数据同步（推拉一体）
  if (urlPath === '/api/sync' && req.method === 'POST') {
    try {
      // 验证令牌
      const authHeader = req.headers['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return sendError(res, 401, '未登录或令牌已过期');
      }
      const token = authHeader.slice(7);
      const tokenData = validateToken(token);
      if (!tokenData) return sendError(res, 401, '令牌无效或已过期');

      const body = await parseBody(req);
      const { action, appState: clientState, userData: clientUserData, clientVersion } = body;

      // action: 'pull' — 只拉取服务器最新数据
      // action: 'push' — 推送本地数据到服务器，并返回合并结果
      // action: 'sync' — 推送 + 拉取（默认）

      if (action === 'pull') {
        const userData = readUserData(tokenData.userId);
        // 返回所有用户的钱包关键数据（用于余额同步）
        const safeUsers = users.map(u => ({
          id: u.id,
          username: u.username,
          nickname: u.nickname,
          role: u.role,
          permissions: u.permissions,
          balance: u.balance || 0,
          totalWithdrawn: u.totalWithdrawn || 0,
          withdrawHistory: u.withdrawHistory || [],
          createdAt: u.createdAt,
        }));
        return sendJSON(res, 200, {
          appState: { ...appState, users: safeUsers },
          userData: userData || {},
          serverVersion: appState._version,
        });
      }

      // push / sync: 接收客户端数据
      // 平台共享数据写入全局 appState（订单/产品/优惠券等）
      if (clientState) {
        if (clientState.orders) appState.orders = clientState.orders;
        if (clientState.afterSalesRequests) appState.afterSalesRequests = clientState.afterSalesRequests;
        if (clientState.platformSettings) {
          appState.platformSettings = { ...appState.platformSettings, ...clientState.platformSettings };
        }
        if (clientState.adminData) {
          appState.adminData = { ...appState.adminData, ...clientState.adminData };
        }
        if (clientState.customProducts) appState.customProducts = clientState.customProducts;
        if (clientState.disabledProductIds) appState.disabledProductIds = clientState.disabledProductIds;
        if (clientState.coupons) appState.coupons = clientState.coupons;
        if (clientState.feedbacks) appState.feedbacks = clientState.feedbacks;
        if (clientState.users) {
          clientState.users.forEach(clientUser => {
            const serverUser = users.find(u => u.id === clientUser.id);
            if (serverUser) {
              serverUser.nickname = clientUser.nickname || serverUser.nickname;
              serverUser.role = clientUser.role || serverUser.role;
              serverUser.permissions = clientUser.permissions || serverUser.permissions;
              serverUser.balance = clientUser.balance != null ? clientUser.balance : serverUser.balance;
              serverUser.totalWithdrawn = clientUser.totalWithdrawn != null ? clientUser.totalWithdrawn : serverUser.totalWithdrawn || 0;
              serverUser.withdrawHistory = clientUser.withdrawHistory || serverUser.withdrawHistory || [];
              serverUser.securityQuestions = clientUser.securityQuestions || serverUser.securityQuestions;
              // 同步密码哈希（兼容 password 和 passwordHash）
              if (clientUser.passwordHash) {
                serverUser.passwordHash = clientUser.passwordHash;
              } else if (clientUser.password && !serverUser.passwordHash) {
                // 客户端传的是明文 password，服务器端也存储（用于兼容旧客户端）
                serverUser.password = clientUser.password;
              }
            } else if (clientUser.passwordHash || clientUser.password) {
              // 新用户：检查是否有密码
              if (!users.find(u => u.username === clientUser.username)) {
                const newUser = { ...clientUser };
                // 确保有密码字段
                if (!newUser.passwordHash && newUser.password) {
                  newUser.passwordHash = hashServerPassword(newUser.password);
                }
                users.push(newUser);
              }
            }
          });
          saveUsers();
        }
        saveState();
      }

      // 用户独立数据写入各自文件（购物车/已购订单/已接订单等）
      if (clientUserData) {
        writeUserData(tokenData.userId, clientUserData);
      }

      const userData = readUserData(tokenData.userId);

      sendJSON(res, 200, {
        appState,
        userData: userData || {},
        serverVersion: appState._version,
        synced: true,
      });
    } catch (e) {
      sendError(res, 400, e.message);
    }
    return;
  }

  // ── POST /api/change-password ── 修改密码（需登录）
  if (urlPath === '/api/change-password' && req.method === 'POST') {
    try {
      const authHeader = req.headers['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return sendError(res, 401, '未登录或令牌已过期');
      }
      const token = authHeader.slice(7);
      const tokenData = validateToken(token);
      if (!tokenData) return sendError(res, 401, '令牌无效或已过期');

      const body = await parseBody(req);
      const { oldPassword, oldPasswordHash, newPassword, newPasswordHash } = body;

      const user = users.find(u => u.id === tokenData.userId);
      if (!user) return sendError(res, 404, '用户不存在');

      // 验证旧密码
      let oldPwdValid = false;
      if (oldPasswordHash && user.passwordHash === oldPasswordHash) {
        oldPwdValid = true;
      } else if (oldPassword && user.password === oldPassword) {
        oldPwdValid = true;
      }
      if (!oldPwdValid) return sendError(res, 401, '当前密码错误');

      if (oldPassword === newPassword) return sendError(res, 400, '新密码不能与当前密码相同');

      // 更新密码
      if (newPasswordHash) {
        user.passwordHash = newPasswordHash;
      } else if (newPassword) {
        user.passwordHash = hashServerPassword(newPassword);
        user.password = newPassword;
      }
      saveUsers();
      console.log(`[修改密码] ${user.username} 修改了密码`);

      sendJSON(res, 200, { success: true });
    } catch (e) {
      sendError(res, 400, e.message);
    }
    return;
  }

  // ── POST /api/change-password-anon ── 未登录修改密码（需用户名+旧密码验证）
  if (urlPath === '/api/change-password-anon' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { username, oldPassword, oldPasswordHash, newPassword, newPasswordHash } = body;

      if (!username) return sendError(res, 400, '用户名不能为空');
      if (!oldPassword && !oldPasswordHash) return sendError(res, 400, '旧密码不能为空');
      if (!newPassword && !newPasswordHash) return sendError(res, 400, '新密码不能为空');

      const user = users.find(u => u.username === username);
      if (!user) return sendError(res, 404, '用户不存在');

      // 验证旧密码
      let oldPwdValid = false;
      if (oldPasswordHash && user.passwordHash === oldPasswordHash) {
        oldPwdValid = true;
      } else if (oldPassword && (user.password === oldPassword || user.passwordHash === hashServerPassword(oldPassword))) {
        oldPwdValid = true;
      }
      if (!oldPwdValid) return sendError(res, 401, '当前密码错误');

      if (oldPassword === newPassword) return sendError(res, 400, '新密码不能与当前密码相同');

      // 更新密码
      user.password = newPassword || '';
      user.passwordHash = newPasswordHash || hashServerPassword(newPassword);
      saveUsers();
      console.log(`[修改密码-离线] ${username} 修改了密码`);

      sendJSON(res, 200, { success: true });
    } catch (e) {
      sendError(res, 400, e.message);
    }
    return;
  }

  // ── POST /api/reset-password ── 通过密保重置密码
  if (urlPath === '/api/reset-password' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { username, securityAnswers, newPassword, newPasswordHash } = body;

      if (!username) return sendError(res, 400, '用户名不能为空');
      if (!securityAnswers || securityAnswers.length < 3) return sendError(res, 400, '请提供3个密保答案');
      if (!newPassword && !newPasswordHash) return sendError(res, 400, '新密码不能为空');

      const user = users.find(u => u.username === username);
      if (!user) return sendError(res, 404, '用户不存在');
      if (!user.securityQuestions || user.securityQuestions.length < 3) {
        return sendError(res, 400, '该账号未设置密保问题');
      }

      // 验证密保答案 (与客户端 simpleHash 保持一致)
      const simpleHash = (str) => {
        let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
        for (let i = 0; i < str.length; i++) {
          const ch = str.charCodeAt(i);
          h1 = Math.imul(h1 ^ ch, 2654435761);
          h2 = Math.imul(h2 ^ ch, 1597334677);
        }
        return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
      };
      for (let i = 0; i < 3; i++) {
        const expectedHash = simpleHash(user.securityQuestions[i].question + '::' + securityAnswers[i].toLowerCase() + '::pc_sec_salt');
        if (expectedHash !== user.securityQuestions[i].answerHash) {
          return sendError(res, 401, `密保问题 ${i+1} 答案错误`);
        }
      }

      // 更新密码
      user.password = newPassword || '';
      user.passwordHash = newPasswordHash || hashServerPassword(newPassword);
      saveUsers();
      console.log(`[重置密码] ${username} 通过密保重置了密码`);

      sendJSON(res, 200, { success: true });
    } catch (e) {
      sendError(res, 400, e.message);
    }
    return;
  }

  // ── POST /api/check-user ── 检查用户是否存在（用于找回密码）
  if (urlPath === '/api/check-user' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { username } = body;
      if (!username) return sendError(res, 400, '用户名不能为空');
      const user = users.find(u => u.username === username);
      if (!user) return sendJSON(res, 200, { exists: false });
      // 只返回必要信息，不返回密码
      sendJSON(res, 200, {
        exists: true,
        user: {
          id: user.id,
          username: user.username,
          nickname: user.nickname,
          securityQuestions: user.securityQuestions,
        }
      });
    } catch (e) {
      sendError(res, 400, e.message);
    }
    return;
  }

  // ── GET /api/health ── 健康检查
  if (urlPath === '/api/health') {
    sendJSON(res, 200, {
      status: 'ok',
      uptime: process.uptime(),
      users: users.length,
      orders: (appState.orders || []).length,
      version: appState._version,
    });
    return;
  }

  sendError(res, 404, 'API 端点不存在');
}

// ── 创建 HTTP 服务器 ──
const server = http.createServer(async (req, res) => {
  const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket.remoteAddress;

  // 限流检查
  if (!checkRateLimit(clientIP)) {
    res.writeHead(429, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h2>429 Too Many Requests</h2><p>请求过于频繁，请稍后再试。</p>');
    return;
  }

  // URL 解析
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const urlPath = url.pathname;

  // API 路由
  if (urlPath.startsWith('/api/')) {
    try {
      await handleAPI(req, res, urlPath);
    } catch (e) {
      console.error('[API ERROR]', urlPath, e.message);
      sendError(res, 500, '服务器内部错误');
    }
    return;
  }

  // 静态文件服务
  let filePath = urlPath === '/' ? '/index.html' : urlPath;
  filePath = path.join(__dirname, filePath);

  // 路径穿越防护
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('403 Forbidden');
    return;
  }

  // 请求方法检查
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405);
    res.end('405 Method Not Allowed');
    return;
  }

  // 读取并返回文件
  const ext = path.extname(filePath).toLowerCase();
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h2>404 Not Found</h2>');
      } else {
        res.writeHead(500);
        res.end('500 Internal Server Error');
      }
      return;
    }

    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      ...SECURITY_HEADERS,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    };

    res.writeHead(200, headers);
    res.end(data);
  });
});

// ── 启动服务器 ──
server.listen(PORT, HOST, () => {
  const lanIPs = getLANIPs();
  const pad = (str, len) => str + ' '.repeat(Math.max(0, len - str.length));

  console.log('\n' + '═'.repeat(58));
  console.log('  🐾  PetCreative 平台 v2.0  —  跨设备数据同步已启用');
  console.log('═'.repeat(58));
  console.log(`  本机访问:    http://localhost:${PORT}`);
  console.log(`  本机访问:    http://127.0.0.1:${PORT}`);
  for (const ip of lanIPs) {
    console.log(`  局域网访问:  http://${ip}:${PORT}`);
  }
  console.log('─'.repeat(58));
  console.log('  📱 手机 / 其他电脑打开上面的"局域网访问"地址');
  console.log('  🔄 登录同一账号即可跨设备同步数据');
  console.log(`  👥 当前注册用户: ${users.length}  |  订单数: ${(appState.orders || []).length}`);
  console.log('═'.repeat(58) + '\n');
});

// ── 优雅退出 ──
process.on('SIGINT', () => {
  console.log('\n🛑 正在保存数据...');
  backupData();
  saveUsers();
  saveState();
  console.log('✅ 数据已保存，服务器已停止。');
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  console.error('[FATAL]', err);
});
