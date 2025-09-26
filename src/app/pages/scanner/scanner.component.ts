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
  // ✅ FORMATOS OPTIMIZADOS para tu patrón específico
  formats = [
    BarcodeFormat.CODE_128,     // Más probable para documentos largos
    BarcodeFormat.CODE_39,      // Común en documentos
    BarcodeFormat.CODABAR,      
    BarcodeFormat.ITF,          
    BarcodeFormat.CODE_93,
    BarcodeFormat.PDF_417,      // Para códigos 2D largos
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
  
  // Lista de códigos válidos encontrados
  validCodes: Array<{text: string, format: string, timestamp: Date, confidence: number}> = [];
  allScannedCodes: Array<{text: string, format: string, timestamp: Date}> = [];

  // Patrón específico que buscas: J5-STR-######-#####-#####-######
  targetPattern = /J5\s*-?\s*STR\s*-?\s*\d{6}\s*-?\s*\d{5}\s*-?\s*\d{5}\s*-?\s*\d{6}/gi;

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
    
    // Guardar en historial completo
    this.allScannedCodes.unshift({
      text: cleaned,
      format: format,
      timestamp: new Date()
    });
    
    if (this.allScannedCodes.length > 15) {
      this.allScannedCodes = this.allScannedCodes.slice(0, 15);
    }
    
    // Analizar si coincide con el patrón objetivo
    const analysisResult = this.analyzeTargetPattern(cleaned);
    
    if (analysisResult.isValid) {
      console.log('✅ ¡CÓDIGO VÁLIDO ENCONTRADO!');
      this.validCodes.unshift({
        text: cleaned,
        format: format,
        timestamp: new Date(),
        confidence: analysisResult.confidence
      });
      
      this.validPattern = true;
      this.lastResult = cleaned;
      this.lastIgnored = null;
      
      // Opcional: pausar escaneo por 2 segundos cuando encuentres un código válido
      this.pauseScanning(2000);
      
      // Vibrar si está disponible
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
      
      // Notification sound (si está disponible)
      this.playSuccessSound();
      
    } else {
      console.log('⚠️ Código no coincide con patrón objetivo');
      this.lastIgnored = cleaned;
      this.validPattern = false;
    }
    
    // Siempre mostrar el último código leído
    this.lastResult = cleaned;
  }

  analyzeTargetPattern(text: string): {isValid: boolean, confidence: number, matchedPattern?: string} {
    console.log('🎯 ANALIZANDO PATRÓN OBJETIVO...');
    
    // Buscar patrón exacto: J5-STR-######-#####-#####-######
    const exactMatch = text.match(this.targetPattern);
    if (exactMatch) {
      console.log('✅ PATRÓN EXACTO ENCONTRADO:', exactMatch[0]);
      return {
        isValid: true,
        confidence: 100,
        matchedPattern: exactMatch[0]
      };
    }
    
    // Buscar variaciones más flexibles
    const flexiblePattern = /J5[\s\-]*STR[\s\-]*\d+[\s\-]*\d+[\s\-]*\d+[\s\-]*\d+/gi;
    const flexibleMatch = text.match(flexiblePattern);
    if (flexibleMatch) {
      console.log('✅ PATRÓN FLEXIBLE ENCONTRADO:', flexibleMatch[0]);
      return {
        isValid: true,
        confidence: 80,
        matchedPattern: flexibleMatch[0]
      };
    }
    
    // Buscar componentes individuales
    let confidence = 0;
    let foundComponents = [];
    
    if (text.includes('J5')) {
      confidence += 25;
      foundComponents.push('J5');
    }
    
    if (text.toUpperCase().includes('STR')) {
      confidence += 25;
      foundComponents.push('STR');
    }
    
    // Buscar secuencias numéricas largas
    const numberSequences = text.match(/\d{4,}/g);
    if (numberSequences && numberSequences.length >= 2) {
      confidence += 20;
      foundComponents.push(`${numberSequences.length} secuencias numéricas`);
    }
    
    if (foundComponents.length > 0) {
      console.log('🔍 Componentes encontrados:', foundComponents.join(', '));
      console.log('🔍 Confianza:', confidence + '%');
    }
    
    return {
      isValid: confidence >= 50,
      confidence: confidence
    };
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
    const result = this.analyzeTargetPattern(testText);
    console.log('🧪 Test del patrón:', testText);
    console.log('🧪 Resultado:', result);
    return result;
  }
}