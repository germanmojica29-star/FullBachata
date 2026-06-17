const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const mongoose = require('mongoose'); 

const app = express();
app.use(express.json());

// Cambio optimizado para evitar problemas de rutas en la nube de Render
app.use(express.static(path.join(__dirname, 'public')));

// Ruta para que cargue el index.html automáticamente al entrar al enlace directo
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// CONFIGURACIÓN DE TU BASE DE DATOS EN LA NUBE
const MONGO_URI = "mongodb+srv://fullbachta:12345@cluster0.nhqazb2.mongodb.net/sistema_qr?appName=Cluster0";
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ ¡Conectado con éxito a MongoDB Atlas en la nube!'))
    .catch(err => console.error('❌ Error al conectar a la base de datos:', err));

// Estructura oficial de cómo se guardará un asistente en la base de datos
const AttendeeSchema = new mongoose.Schema({
    ticketId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    used: { type: Boolean, default: false },
    usedAt: { type: String, default: null }
});

const Attendee = mongoose.model('Attendee', AttendeeSchema);

// 1. RUTA PARA REGISTRAR AL ASISTENTE Y GENERAR EL QR
app.post('/api/register', async (req, res) => {
    const { name } = req.body;
    if (!name || name.trim() === "") {
        return res.status(400).json({ error: 'El nombre es requerido' });
    }

    const ticketId = uuidv4(); 

    try {
        const nuevoAsistente = new Attendee({
            ticketId,
            name: name.trim()
        });
        await nuevoAsistente.save();

        const qrDataUrl = await QRCode.toDataURL(ticketId);
        res.json({ success: true, ticketId, qrDataUrl, name: nuevoAsistente.name });
    } catch (err) {
        res.status(500).json({ error: 'Error al registrar en la nube' });
    }
});

// 2. RUTA PARA VALIDAR EL QR EN LA PUERTA (EVITA DUPLICADOS)
app.post('/api/validate', async (req, res) => {
    const { ticketId } = req.body;

    try {
        const ticket = await Attendee.findOne({ ticketId });

        if (!ticket) {
            return res.json({ 
                status: 'INVALID', 
                message: '¡ALERTA! EL CÓDIGO ESCANEADO NO ES REAL O ES FALSO ❌' 
            });
        }

        if (ticket.used) {
            return res.json({
                status: 'USED',
                name: ticket.name,
                message: `❌ ACCESO DENEGADO: Este boleto ya ingresó al evento a las ${ticket.usedAt}.`
            });
        }

        ticket.used = true;
        const ahora = new Date();
        ticket.usedAt = ahora.toLocaleTimeString() + ' ' + ahora.toLocaleDateString();
        await ticket.save(); 

        return res.json({
            status: 'ALLOWED',
            name: ticket.name,
            message: '¡ACCESO CONCEDIDO! Bienvenido(a) al evento ✅'
        });
    } catch (err) {
        res.status(500).json({ error: 'Error en la validación' });
    }
});

// 3. RUTA PARA OBTENER LA LISTA COMPLETA DE ASISTENTES
app.get('/api/attendees', async (req, res) => {
    try {
        const dbList = await Attendee.find();
        const list = dbList.map(doc => ({
            id: doc.ticketId, 
            name: doc.name,
            used: doc.used,
            usedAt: doc.usedAt
        }));
        res.json(list);
    } catch (err) {
        res.status(500).json({ error: 'Error al traer la lista' });
    }
});

// 4. RUTA PARA ELIMINAR UN ASISTENTE
app.delete('/api/attendees/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const resultado = await Attendee.findOneAndDelete({ ticketId: id });
        if (!resultado) return res.status(404).json({ error: 'Asistente no encontrado' });
        res.json({ success: true, message: 'Asistente eliminado correctamente' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar' });
    }
});

// 5. RUTA PARA EDITAR EL NOMBRE DE UN ASISTENTE
app.put('/api/attendees/:id', async (req, res) => {
    const { id } = req.params;
    const { newName } = req.body;

    if (!newName || newName.trim() === "") {
        return res.status(400).json({ error: 'El nombre no puede estar vacío' });
    }

    try {
        const ticket = await Attendee.findOne({ ticketId: id });
        if (!ticket) return res.status(404).json({ error: 'Asistente no encontrado' });

        ticket.name = newName.trim();
        await ticket.save();

        res.json({ success: true, message: 'Nombre actualizado', name: ticket.name });
    } catch (err) {
        res.status(500).json({ error: 'Error al editar' });
    }
});
// CONFIGURACIÓN DINÁMICA DEL PUERTO PARA RENDER
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(`Servidor activo y escuchando en el puerto: ${PORT}`);
    console.log(`=================================================`);
});