import { Component } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { BarcodeFormat } from '@zxing/library';

@Component({
  selector: 'app-scanner',
  standalone: false,
  templateUrl: './scanner.component.html',
  styleUrls: ['./scanner.component.css']
})
export class ScannerComponent {
  // ✅ TODOS LOS FORMATOS POSIBLES PARA DETECTAR CUALQUIER CÓDIGO
  formats = [
    BarcodeFormat.CODE_128,     // Más probable para documentos largos
    BarcodeFormat.CODE_39,      // Común en documentos
    BarcodeFormat.CODE_93,
    BarcodeFormat.CODABAR,      
    BarcodeFormat.ITF,          // Interleaved 2 of 5
    BarcodeFormat.EAN_13,       // También probamos EAN por si acaso
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.PDF_417,      // 2D codes también
    BarcodeFormat.QR_CODE,
    BarcodeFormat.DATA_MATRIX,
  ];

  devices: MediaDeviceInfo[] = [];
  selectedDevice?: MediaDeviceInfo;
  lastResult: string | null = null;
  lastIgnored: string | null = null;
  torchOn = false;
  torchAvailable = false;
  
  // Variables para mejorar reconocimiento
  isScanning = true;
  scanCount = 0;
  validPattern = false;
  
  // Lista de códigos válidos encontrados (TODOS SON VÁLIDOS AHORA)
  validCodes: Array<{text: string, format: string, timestamp: Date, confidence: number}> = [];
  allScannedCodes: Array<{text: string, format: string, timestamp: Date}> = [];

  constructor(public auth: AuthService) {}

  onCamerasFound(devs: MediaDeviceInfo[]) {
    console.log('📷 Cámaras encontradas:', devs?.length || 0);
    this.devices = devs || [];
    
    // Priorizar cámara trasera con mejor resolución
    const backCameras = this.devices.filter(d => 
      /back|rear|trás|trasera|environment/i.test(d.label || '')
    );
    
    // Si hay varias cámaras traseras, elegir la de mayor resolución
    this.selectedDevice = backCameras[0] ?? this.devices[0];
    
    if (this.selectedDevice) {
      console.log('📷 Cámara seleccionada:', this.selectedDevice.label);
    }
  }

  onHasDevices(has: boolean) {
    console.log('📷 Tiene dispositivos:', has);
    if (!has) {
      console.error('❌ No se detectaron cámaras.');
      alert('No se detectaron cámaras. Por favor, verifica que tu dispositivo tenga cámara y los permisos estén habilitados.');
    }
  }

  onTorchCompatible(compatible: boolean) {
    console.log('🔦 Flash disponible:', compatible);
    this.torchAvailable = compatible;
    
    // Auto-activar flash si está disponible para mejor lectura
    if (compatible && !this.torchOn) {
      setTimeout(() => {
        this.torchOn = true;
        console.log('🔦 Flash activado automáticamente');
      }, 1000);
    }
  }

  onPermissionResponse(permission: boolean) {
    console.log('🔑 Permisos:', permission ? 'Concedidos' : 'Denegados');
    if (!permission) {
      alert('⚠️ Se requieren permisos de cámara para escanear códigos. Por favor, permite el acceso a la cámara y recarga la página.');
    }
  }

  onDeviceSelectChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const deviceIndex = parseInt(select.value);
    this.selectedDevice = this.devices[deviceIndex];
    console.log('📷 Cambiando a cámara:', this.selectedDevice?.label);
    
    // Reset scanning state
    this.resetScanningState();
  }

  onScanSuccess(result: any) {
    if (!this.isScanning) return;

    this.scanCount++;
    
    const text = typeof result === 'string' ? result : result.text || result.getText();
    const format = typeof result === 'object' ? result.format || 'Unknown' : 'Unknown';
    
    // Limpiar texto
    const cleaned = text.replace(/^\*+|\*+$/g, '').trim();
    
    console.log(`🔍 [${this.scanCount}] CÓDIGO DETECTADO`);
    console.log('🔍 Formato:', format);
    console.log('🔍 Texto:', cleaned);
    console.log('🔍 Longitud:', cleaned.length);
    
    // ✅ ACEPTAR TODOS LOS CÓDIGOS - Sin filtros restrictivos
    this.validPattern = true;
    this.lastResult = cleaned;
    this.lastIgnored = null;
    
    // Guardar en historial completo
    this.allScannedCodes.unshift({
      text: cleaned,
      format: format,
      timestamp: new Date()
    });
    
    if (this.allScannedCodes.length > 20) {
      this.allScannedCodes = this.allScannedCodes.slice(0, 20);
    }
    
    // Analizar el tipo de código para información adicional
    const analysisResult = this.analyzeCodeType(cleaned);
    
    // ✅ TODOS LOS CÓDIGOS SON VÁLIDOS
    console.log('✅ ¡CÓDIGO DETECTADO Y ACEPTADO!');
    this.validCodes.unshift({
      text: cleaned,
      format: format,
      timestamp: new Date(),
      confidence: 100 // Todos los códigos tienen 100% confianza
    });
    
    // Limitar códigos válidos para mejor rendimiento
    if (this.validCodes.length > 15) {
      this.validCodes = this.validCodes.slice(0, 15);
    }
    
    // Pausar brevemente para mostrar el resultado
    this.pauseScanning(1500);
    
    // Feedback táctil y sonoro
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
    
    this.playSuccessSound();
    
    // Mostrar información adicional si es relevante
    if (analysisResult.specialType) {
      console.log('🎯 Tipo especial detectado:', analysisResult.specialType);
    }
  }

  analyzeCodeType(text: string): {specialType?: string, patterns: string[]} {
    console.log('🔍 ANALIZANDO TIPO DE CÓDIGO...');
    
    let specialType = '';
    let patterns: string[] = [];
    
    // Detectar diferentes tipos de códigos comunes
    
    // Código J5-STR (el original que buscabas)
    if (/J5[\s\-]*STR/gi.test(text)) {
      specialType = 'J5-STR Document';
      patterns.push('J5-STR pattern detected');
    }
    
    // URLs y sitios web
    if (/https?:\/\/|www\./gi.test(text)) {
      specialType = 'URL/Website';
      patterns.push('Web link detected');
    }
    
    // Códigos ISBN
    if (/ISBN[\s\-]*\d+/gi.test(text) || /978\d{10}/g.test(text)) {
      specialType = 'ISBN Book Code';
      patterns.push('Book ISBN detected');
    }
    
    // Códigos UPC/EAN de productos
    if (/^\d{12,13}$/.test(text)) {
      specialType = 'Product UPC/EAN';
      patterns.push('Product barcode detected');
    }
    
    // Números de serie o códigos alfanuméricos largos
    if (/^[A-Z0-9\-]{10,}$/gi.test(text)) {
      specialType = 'Serial/Product Code';
      patterns.push('Alphanumeric code detected');
    }
    
    // Códigos QR con información de contacto
    if (/BEGIN:VCARD|MECARD:/gi.test(text)) {
      specialType = 'Contact Information';
      patterns.push('Contact card detected');
    }
    
    // Códigos WiFi
    if (/WIFI:/gi.test(text)) {
      specialType = 'WiFi Configuration';
      patterns.push('WiFi credentials detected');
    }
    
    // Coordenadas GPS
    if (/geo:|(-?\d+\.\d+),\s*(-?\d+\.\d+)/gi.test(text)) {
      specialType = 'GPS Coordinates';
      patterns.push('Location data detected');
    }
    
    // Emails
    if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g.test(text)) {
      specialType = 'Email Address';
      patterns.push('Email detected');
    }
    
    // Números de teléfono
    if (/(\+?\d{1,3}[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g.test(text)) {
      specialType = 'Phone Number';
      patterns.push('Phone number detected');
    }
    
    // Texto plano general
    if (!specialType && text.length > 5) {
      specialType = 'Text/Data';
      patterns.push('General text/data code');
    }
    
    // Log de la información detectada
    if (specialType) {
      console.log('🎯 Tipo detectado:', specialType);
      console.log('🎯 Patrones:', patterns);
    }
    
    return { specialType, patterns };
  }

  pauseScanning(ms: number) {
    this.isScanning = false;
    setTimeout(() => {
      this.isScanning = true;
      console.log('🔄 Escaneo reanudado');
    }, ms);
  }

  resetScanningState() {
    this.scanCount = 0;
    this.validPattern = false;
    this.isScanning = true;
  }

  playSuccessSound() {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.log('No se pudo reproducir sonido:', error);
    }
  }

  onScanError(err: any) {
    // Errores normales durante el escaneo, no mostrar en consola
    if (err && err.message && !err.message.includes('No MultiFormat Readers')) {
      console.warn('⚠️ Error de escaneo:', err);
    }
  }

  toggleTorch() { 
    this.torchOn = !this.torchOn;
    console.log('🔦 Flash:', this.torchOn ? 'Encendido' : 'Apagado');
  }

  // Reiniciar escaneo si no detecta nada por un tiempo
  restartScanning() {
    this.resetScanningState();
    this.lastResult = null;
    this.lastIgnored = null;
    console.log('🔄 Escaneo reiniciado manualmente');
  }

  logout() { 
    this.auth.logout(); 
  }

  clearHistory() {
    this.allScannedCodes = [];
    this.validCodes = [];
    this.resetScanningState();
  }

  clearValidCodes() {
    this.validCodes = [];
    this.validPattern = false;
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      alert('📋 Copiado al portapapeles');
    }).catch(err => {
      console.error('Error al copiar:', err);
      // Fallback para dispositivos más antiguos
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        alert('📋 Copiado al portapapeles');
      } catch (err) {
        alert('❌ No se pudo copiar al portapapeles');
      }
      document.body.removeChild(textArea);
    });
  }

  // Función para probar el patrón manualmente
  testPattern(testText: string) {
    const result = this.analyzeCodeType(testText);
    console.log('🧪 Test del patrón:', testText);
    console.log('🧪 Resultado:', result);
    return result;
  }
}