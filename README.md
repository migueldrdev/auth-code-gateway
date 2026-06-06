# 🛡️ Auth Code Gateway (Event-Driven Router)

Microservicio en Node.js diseñado para interceptar, extraer y enrutar códigos de verificación de un solo uso (OTP) a través de una arquitectura basada en eventos, solucionando el problema de distribución de accesos en entornos multi-usuario.

## 🚀 Tecnologías (Stack)
* **Backend:** Node.js, Express.js
* **Canal de Eventos / Interfaz:** Telegram Bot API (`telegraf`)
* **Procesamiento de Datos:** IMAP, Mailparser, Regex
* **Base de Datos:** PostgreSQL (Supabase)

## 🏗️ Arquitectura del Sistema
El sistema utiliza un enfoque de **Event Loop y Timeouts** para manejar la concurrencia. Cuando un usuario solicita un acceso, el sistema genera un "ticket de sesión" y monitorea asíncronamente la bandeja de entrada, garantizando la idempotencia (evitando enviar códigos repetidos o a usuarios incorrectos).

## 💻 Instalación y Uso (Desarrollo Local)
1. Clonar el repositorio.
2. Instalar dependencias: `npm install`
3. Configurar variables de entorno en `.env` (Ver `.env.example`).
4. Iniciar el servidor: `npm run dev`

---

## 🤖 AI & Developer Context
* **Paradigma:** Código asíncrono (`async/await`). Priorizar el manejo de errores con bloques `try/catch`.
* **Idioma:** Comentarios, nombres de funciones y variables en español.
* **Flujo:** Las funciones IMAP no deben bloquear el hilo principal. Usar el patrón de arquitectura por capas (Controladores, Servicios, Utilidades) a medida que el proyecto escale con Express.