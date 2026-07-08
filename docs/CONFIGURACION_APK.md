# Configuración completa del APK de $K Dolar

Esta guía explica cómo funciona el APK de **$K Dolar**, qué herramientas usa el proyecto, cómo se firma la aplicación, qué secretos se deben configurar en GitHub Actions y qué se necesita en una computadora local para compilar o validar el APK.

El objetivo es que el archivo descargable:

```text
public/$k-dolar.apk
```

sea un APK real, firmado, instalable en Android y publicado por Vercel junto con la web.

## 1. Arquitectura del proyecto

El proyecto usa estas tecnologías:

- **Vite + React**: construye la interfaz web.
- **Tailwind CSS**: maneja estilos responsive.
- **Capacitor**: convierte la web en una app Android mediante WebView.
- **Vercel**: publica la web.
- **GitHub Actions**: genera automáticamente el APK firmado.
- **Android Gradle Plugin**: compila el proyecto Android.
- **Java JDK + keytool**: crea y gestiona la llave de firma.

Documentación oficial útil:

- Vite: https://vite.dev/guide/
- Capacitor Android: https://capacitorjs.com/docs/android
- Android App Signing: https://developer.android.com/studio/publish/app-signing
- GitHub Actions Secrets: https://docs.github.com/actions/security-guides/using-secrets-in-github-actions
- Vercel Deployments: https://vercel.com/docs/deployments/overview

## 2. Cómo funciona la APK en este proyecto

La APK no contiene toda la lógica como una app Android nativa tradicional. Funciona como un contenedor nativo con WebView.

La configuración principal está en:

```text
capacitor.config.json
```

Configuración actual:

```json
{
  "appId": "com.kbrgarcia.dolarapk",
  "appName": "$K Dolar",
  "webDir": "dist",
  "server": {
    "url": "https://k-dolar.vercel.app/",
    "cleartext": false
  }
}
```

Qué significa cada propiedad:

- `appId`: identificador único de Android. Debe mantenerse estable para permitir actualizaciones.
- `appName`: nombre visible de la app.
- `webDir`: carpeta de build web generada por Vite.
- `server.url`: URL que abrirá la APK dentro de la WebView.
- `cleartext: false`: bloquea tráfico HTTP no seguro. La app solo debe usar HTTPS.

Como la APK apunta a Vercel, cuando se despliega una nueva versión web en Vercel, la app instalada carga esa nueva versión sin reinstalar el APK.

Solo necesitas generar una nueva APK cuando cambien cosas nativas, por ejemplo:

- icono de Android,
- nombre nativo,
- permisos Android,
- `capacitor.config.json`,
- configuración Gradle,
- firma,
- versión nativa.

## 3. Por qué el APK no puede estar vacío

Android solo instala archivos APK reales. Un archivo vacío de `0 bytes` no es una app.

El archivo final debe:

- pesar más de `0 bytes`,
- tener estructura ZIP/APK válida,
- estar firmado,
- tener certificado válido,
- incluir el icono y manifiesto Android,
- coincidir con el `applicationId`.

El proyecto espera publicar el APK aquí:

```text
public/$k-dolar.apk
```

Vercel publicará ese archivo en:

```text
https://k-dolar.vercel.app/$k-dolar.apk
```

El componente `DownloadBtn.jsx` verifica si ese archivo existe y tiene contenido antes de habilitar el botón de descarga.

## 4. Herramientas necesarias en una computadora local

Si quieres compilar el APK en tu propia computadora, necesitas:

1. Node.js
2. npm
3. Java JDK
4. Android Studio o Android SDK
5. Gradle Wrapper incluido en el proyecto
6. Keystore de firma

### 4.1 Verificar Node.js

Ejecuta:

```bash
node -v
npm -v
```

Si ambos comandos responden con versiones, Node está instalado.

### 4.2 Verificar Java

Ejecuta:

```bash
java -version
keytool -help
```

`java` permite ejecutar herramientas de compilación Android.

`keytool` permite crear el keystore de firma.

Si `java` no existe en Ubuntu/Linux, instala JDK:

```bash
sudo apt update
sudo apt install openjdk-21-jdk
```

Luego verifica:

```bash
java -version
keytool -help
```

### 4.3 Por qué Java es necesario

Android usa Gradle y herramientas basadas en Java para compilar, empaquetar y firmar el APK.

Sin Java/JDK, este comando fallará:

```bash
cd android
./gradlew assembleRelease
```

El error típico es:

```text
JAVA_HOME is not set and no 'java' command could be found in your PATH.
```

### 4.4 Configurar JAVA_HOME si hace falta

En Linux puedes ubicar Java con:

```bash
readlink -f $(which java)
```

Normalmente apunta a algo como:

```text
/usr/lib/jvm/java-21-openjdk-amd64/bin/java
```

Entonces `JAVA_HOME` debe apuntar a:

```text
/usr/lib/jvm/java-21-openjdk-amd64
```

Puedes agregar esto a `~/.bashrc`:

```bash
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export PATH=$JAVA_HOME/bin:$PATH
```

Luego recarga la terminal:

```bash
source ~/.bashrc
```

### 4.5 Android Studio / Android SDK

Para compilar localmente, también necesitas Android SDK.

La forma recomendada es instalar Android Studio:

https://developer.android.com/studio

Luego abre Android Studio y asegúrate de instalar:

- Android SDK Platform,
- Android SDK Build-Tools,
- Android SDK Command-line Tools,
- Android Emulator si deseas probar en emulador.

Puedes verificar variables:

```bash
echo $ANDROID_HOME
echo $ANDROID_SDK_ROOT
```

Si están vacías, configura una ruta típica:

```bash
export ANDROID_HOME=$HOME/Android/Sdk
export ANDROID_SDK_ROOT=$HOME/Android/Sdk
export PATH=$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH
```

## 5. Qué es un keystore

Un **keystore** es un archivo que contiene una llave privada usada para firmar la app Android.

Ejemplo:

```text
k-dolar-release.jks
```

Ese archivo identifica que las futuras versiones de la app vienen del mismo desarrollador.

Es muy importante porque:

- Android requiere APK firmado.
- Permite instalar actualizaciones sobre la app existente.
- Si pierdes el keystore, no podrás actualizar la app instalada previamente.
- Si alguien obtiene tu keystore y contraseñas, podría firmar APKs haciéndose pasar por tu app.

Nunca subas el keystore al repositorio.

El proyecto ya ignora archivos sensibles en `.gitignore`:

```gitignore
*.jks
*.keystore
android/key.properties
android/app/release/
```

## 6. Crear el keystore con keytool

Ejecuta este comando en una carpeta segura de tu computadora:

```bash
keytool -genkeypair \
  -v \
  -keystore k-dolar-release.jks \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -alias k-dolar
```

Qué significa:

- `-genkeypair`: genera par de llaves.
- `-keystore k-dolar-release.jks`: nombre del archivo keystore.
- `-keyalg RSA`: algoritmo criptográfico.
- `-keysize 2048`: tamaño de llave.
- `-validity 10000`: validez en días.
- `-alias k-dolar`: nombre interno de la llave dentro del keystore.

Cuando pregunte:

```text
¿Es correcto CN=..., OU=..., O=..., L=..., ST=..., C=VE?
[no]:
```

No presiones Enter vacío, porque el valor por defecto es `no`.

Debes escribir:

```text
si
```

Si no lo acepta, prueba:

```text
sí
```

o:

```text
yes
```

Al finalizar tendrás:

```text
k-dolar-release.jks
```

Guárdalo en un lugar seguro.

## 7. Convertir el keystore a Base64

GitHub Secrets guarda texto, no archivos binarios. Por eso se convierte el `.jks` a Base64.

Ejecuta:

```bash
base64 -w 0 k-dolar-release.jks > k-dolar-release.jks.base64
```

Luego muestra el contenido:

```bash
cat k-dolar-release.jks.base64
```

Copia todo el texto resultante. Ese será el valor de:

```text
ANDROID_KEYSTORE_BASE64
```

## 8. Configurar GitHub Secrets

En GitHub:

1. Entra al repositorio.
2. Ve a `Settings`.
3. Ve a `Secrets and variables`.
4. Selecciona `Actions`.
5. Click en `New repository secret`.

Debes crear estos 4 secrets:

### 8.1 ANDROID_KEYSTORE_BASE64

Valor:

```text
Contenido completo de k-dolar-release.jks.base64
```

Este secret representa el archivo keystore codificado como texto.

### 8.2 ANDROID_KEYSTORE_PASSWORD

Valor:

```text
Contraseña del keystore
```

Es la contraseña que escribiste cuando creaste `k-dolar-release.jks`.

### 8.3 ANDROID_KEY_ALIAS

Valor recomendado:

```text
k-dolar
```

Debe coincidir exactamente con el alias usado en `keytool`.

### 8.4 ANDROID_KEY_PASSWORD

Valor:

```text
Contraseña de la clave interna
```

Si usaste la misma contraseña para keystore y key, coloca la misma contraseña.

## 9. Cómo usa GitHub Actions esos secrets

El workflow está en:

```text
.github/workflows/build-apk.yml
```

Este workflow hace:

1. Descarga el código.
2. Instala Node.js.
3. Instala Java.
4. Valida que existan los secrets.
5. Instala dependencias con `npm ci`.
6. Decodifica el keystore Base64.
7. Compila el APK release.
8. Firma el APK con el keystore.
9. Copia el APK a `public/$k-dolar.apk`.
10. Sube el APK como artifact.
11. Hace commit automático del APK firmado.

Fragmento clave:

```yaml
env:
  ANDROID_KEYSTORE_PATH: ${{ github.workspace }}/android/keystores/release.jks
  ANDROID_KEYSTORE_PASSWORD: ${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
  ANDROID_KEY_ALIAS: ${{ secrets.ANDROID_KEY_ALIAS }}
  ANDROID_KEY_PASSWORD: ${{ secrets.ANDROID_KEY_PASSWORD }}
run: npm run apk:release
```

## 10. Cómo Gradle firma el APK

La configuración está en:

```text
android/app/build.gradle
```

El proyecto lee variables de entorno:

```gradle
def releaseKeystorePath = System.getenv("ANDROID_KEYSTORE_PATH")
def releaseKeystorePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
def releaseKeyAlias = System.getenv("ANDROID_KEY_ALIAS")
def releaseKeyPassword = System.getenv("ANDROID_KEY_PASSWORD")
```

Luego usa esas variables para firmar:

```gradle
signingConfigs {
    release {
        if (hasReleaseSigningConfig) {
            storeFile file(releaseKeystorePath)
            storePassword releaseKeystorePassword
            keyAlias releaseKeyAlias
            keyPassword releaseKeyPassword
        }
    }
}
```

Esto evita guardar contraseñas directamente en el repositorio.

## 11. Scripts importantes del proyecto

En `package.json` existen estos scripts:

```json
{
  "build": "vite build",
  "cap:sync": "npm run build && npx cap sync",
  "cap:open:android": "npx cap open android",
  "apk:release": "npm run build && npx cap sync android && cd android && ./gradlew assembleRelease",
  "apk:copy": "cp android/app/build/outputs/apk/release/app-release.apk 'public/$k-dolar.apk'"
}
```

### npm run build

Construye la web en:

```text
dist/
```

### npm run cap:sync

Construye la web y sincroniza assets con Android.

### npm run cap:open:android

Abre el proyecto Android en Android Studio.

### npm run apk:release

Construye la web, sincroniza Android y genera APK release.

### npm run apk:copy

Copia el APK firmado generado por Gradle a:

```text
public/$k-dolar.apk
```

## 12. Flujo recomendado para publicar el APK

1. Crea el keystore localmente.
2. Convierte el keystore a Base64.
3. Configura los 4 GitHub Secrets.
4. Sube el proyecto a GitHub.
5. Ve a `Actions`.
6. Ejecuta `Build signed APK`.
7. Espera a que termine.
8. Verifica que se haya generado:

```text
public/$k-dolar.apk
```

9. Vercel detectará el commit y hará deploy.
10. Abre:

```text
https://k-dolar.vercel.app/$k-dolar.apk
```

Debe iniciar descarga del APK.

## 13. Cómo verifica la web si el APK existe

El componente:

```text
src/components/DownloadBtn.jsx
```

hace una petición `HEAD` a:

```text
/$k-dolar.apk
```

Si el archivo existe y tiene tamaño mayor a `0`, habilita la descarga.

Si no existe o está vacío, muestra:

```text
APK pendiente
```

Esto evita que el usuario descargue un archivo roto.

## 14. Headers de Vercel para el APK

El archivo:

```text
vercel.json
```

configura cómo Vercel sirve el APK:

```json
{
  "headers": [
    {
      "source": "/$k-dolar.apk",
      "headers": [
        {
          "key": "Content-Type",
          "value": "application/vnd.android.package-archive"
        },
        {
          "key": "Content-Disposition",
          "value": "attachment; filename=\"$k-dolar.apk\""
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Cache-Control",
          "value": "no-store"
        }
      ]
    }
  ]
}
```

Esto ayuda a que el navegador entienda que debe descargar un APK.

## 15. Por qué Android puede pedir permisos al instalar

Aunque el APK esté correctamente firmado, Android puede mostrar:

```text
Permitir instalar apps desconocidas desde este navegador
```

Esto es normal. Android no permite que una web instale aplicaciones automáticamente.

El usuario debe:

1. Descargar el APK.
2. Abrirlo.
3. Autorizar la instalación si Android lo solicita.
4. Confirmar instalación.

No se puede saltar este paso desde la web de forma segura.

## 16. Cómo se actualiza la APK instalada

La APK instalada carga:

```text
https://k-dolar.vercel.app/
```

Eso significa que cambios en React, Tailwind, hooks, calculadora, histórico y diseño se actualizan al desplegar Vercel.

No necesitas reinstalar la APK para cambios web.

Sí necesitas generar una nueva APK si cambias:

- icono nativo,
- nombre nativo,
- permisos,
- configuración Android,
- `capacitor.config.json`,
- versión nativa,
- firma.

## 17. Diagnóstico de problemas comunes

### El botón muestra APK pendiente

Significa que:

- `public/$k-dolar.apk` no existe, o
- existe pero pesa `0 bytes`, o
- Vercel todavía no desplegó el commit con el APK.

### El workflow falla en Validate signing secrets

Falta uno de estos secrets:

```text
ANDROID_KEYSTORE_BASE64
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
ANDROID_KEY_PASSWORD
```

### El workflow falla al firmar

Posibles causas:

- contraseña incorrecta,
- alias incorrecto,
- Base64 copiado incompleto,
- keystore corrupto,
- `ANDROID_KEY_PASSWORD` no coincide.

### Android dice que el APK está dañado

Posibles causas:

- archivo de `0 bytes`,
- descarga incompleta,
- Vercel sirviendo HTML en vez del APK,
- APK no firmado correctamente,
- navegador cacheó una versión rota.

### No se puede actualizar una app ya instalada

Posibles causas:

- usaste un keystore diferente,
- cambiaste `applicationId`,
- bajaste `versionCode`,
- la app instalada fue firmada con otra llave.

## 18. Checklist final antes de publicar

Verifica:

- [ ] `public/$k-dolar.apk` existe.
- [ ] `public/$k-dolar.apk` pesa más de `0 bytes`.
- [ ] GitHub Actions terminó correctamente.
- [ ] Vercel hizo deploy después del commit del APK.
- [ ] `https://k-dolar.vercel.app/$k-dolar.apk` descarga el APK.
- [ ] Android muestra el logo correcto.
- [ ] La app instalada abre `$K Dolar`.
- [ ] La app carga la web desde Vercel.
- [ ] Guardaste el keystore en lugar seguro.
- [ ] Guardaste las contraseñas en un gestor seguro.

## 19. Comandos rápidos

Validar web:

```bash
npm run lint
npm run build
```

Sincronizar Android:

```bash
npm run cap:sync
```

Abrir Android Studio:

```bash
npm run cap:open:android
```

Generar APK release localmente:

```bash
export ANDROID_KEYSTORE_PATH=/ruta/k-dolar-release.jks
export ANDROID_KEYSTORE_PASSWORD=tu_password
export ANDROID_KEY_ALIAS=k-dolar
export ANDROID_KEY_PASSWORD=tu_password
npm run apk:release
npm run apk:copy
```

Verificar tamaño:

```bash
ls -lh public/'$k-dolar.apk'
```

## 20. Recomendación de seguridad

Guarda estos elementos fuera del repositorio:

```text
k-dolar-release.jks
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_PASSWORD
ANDROID_KEY_ALIAS
```

Si pierdes el keystore, no podrás publicar actualizaciones compatibles con las instalaciones existentes.

Si alguien roba el keystore y las contraseñas, podría firmar APKs como si fueran tuyos.

Por eso el proyecto usa GitHub Secrets y variables de entorno, no contraseñas hardcodeadas.
