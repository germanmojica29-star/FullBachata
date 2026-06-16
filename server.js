const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const mongoose = require('mongoose'); // Cargamos la nueva librería profesional

const app = express();
app.use(express.json());
app.use(express.static('public'));
// Ruta para que cargue el index.html automáticamente al entrar al enlace directo
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// CONFIGURACIÓN DE TU BASE DE DATOS EN LA NUBE
// (Cambia esto por tu enlace real de MongoDB Atlas)
const MONGO_URI = "mongodb+srv://admin:12345@cluster0.nhqazb2.mongodb.net/sistema_qr?appName=Cluster0";

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

    const ticketId = uuidv4(); // Genera el Token secreto

    try {
        // Guardamos al usuario directamente en la base de datos en la nube
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
        await ticket.save(); // Guarda el cambio de estado en la nube

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
            id: doc.ticketId, // Mantenemos el mismo formato para que admin.html no sufra cambios
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

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(`Servidor corriendo en: http://localhost:${PORT}`);
    console.log(`=================================================`);
});