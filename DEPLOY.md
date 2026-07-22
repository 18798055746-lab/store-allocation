# 部署到 Render（免费）

## 第一步：上传到 GitHub

1. 在 GitHub 上创建一个新仓库（比如 `store-allocation`）
2. 把项目代码上传到这个仓库

```bash
git add .
git commit -m "初始化项目"
git remote add origin https://github.com/你的用户名/store-allocation.git
git push -u origin main
```

## 第二步：在 Render 部署

1. 打开 https://render.com
2. 用 GitHub 账号登录
3. 点击 "New" → "Web Service"
4. 选择你刚创建的仓库
5. 配置如下：
   - **Name**: store-allocation（随便取）
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `node server/index.js`
6. 点击 "Create Web Service"

## 第三步：等待部署完成

- Render 会自动构建和部署
- 部署完成后会给你一个网址，类似：`https://store-allocation.onrender.com`
- 把这个网址发给同事就能访问了！

## 注意事项

- Render 免费版会在15分钟无访问后休眠，首次访问可能需要等30秒左右启动
- 数据保存在云端，不会丢失
- 如果需要更新代码，push 到 GitHub 后 Render 会自动重新部署

## 管理员访问

部署后的管理员地址：`https://你的网址/admin`
