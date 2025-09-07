@echo off
echo ================================================
echo   PUSH A GITHUB - NANO BANANA
echo ================================================
echo.
echo Reemplaza TU-USUARIO y NOMBRE-REPO con tus datos
echo.
echo Ejemplo de comandos a ejecutar:
echo.
echo git remote add origin https://github.com/TU-USUARIO/NOMBRE-REPO.git
echo git branch -M main
echo git push -u origin main
echo.
echo ================================================
echo.
set /p usuario="Ingresa tu usuario de GitHub: "
set /p repo="Ingresa el nombre del repositorio: "
echo.
echo Conectando con: https://github.com/%usuario%/%repo%.git
echo.
git remote add origin https://github.com/%usuario%/%repo%.git
git branch -M main
git push -u origin main
echo.
echo ✅ Listo! Tu código está en GitHub
pause