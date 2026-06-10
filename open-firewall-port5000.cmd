@echo off
echo Adding Windows Firewall rule for Noor Beauty Backend (port 5000)...
netsh advfirewall firewall add rule name="Noor Beauty Backend" dir=in action=allow protocol=TCP localport=5000
echo.
echo Done! Port 5000 is now open for your Android phone to connect.
pause
