@echo off
echo ========================================
echo 门店实训志愿分配系统 - 启动脚本
echo ========================================
echo.

echo 1. 安装前端依赖...
call npm install
if errorlevel 1 (
    echo 前端依赖安装失败！
    pause
    exit /b 1
)

echo.
echo 2. 安装后端依赖...
cd server
call npm install
if errorlevel 1 (
    echo 后端依赖安装失败！
    pause
    exit /b 1
)
cd ..

echo.
echo 3. 启动后端服务器（端口3001）...
start "后端服务器" cmd /k "cd server && npm run dev"

echo.
echo 4. 等待后端启动...
timeout /t 3 /nobreak >nul

echo.
echo 5. 启动前端开发服务器（端口5173）...
start "前端服务器" cmd /k "npm run dev"

echo.
echo ========================================
echo 启动完成！
echo.
echo 学员端：http://localhost:5173
echo 管理员端：http://localhost:5173/admin
echo.
echo 数据文件位置：
echo - 门店数据：server/data/stores.json
echo - 学员数据：server/data/students.json
echo - 分配结果：server/data/allocations.json
echo.
echo 按任意键退出此窗口...
echo ========================================
pause >nul
