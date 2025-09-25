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
    BarcodeFormat.CODE_128,     // Más probable para documentos
    BarcodeFormat.CODE_39,      
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
  
  // MODO DEBUG: Lista de todos los códigos leídos
  allScannedCodes: Array<{text: string, format: string, timestamp: Date}> = [];

  constructor(public auth: AuthService) {}

  onCamerasFound(devs: MediaDeviceInfo[]) {
    console.log('📷 Cámaras encontradas:', devs?.length || 0);
    this.devices = devs || [];
    const back = this.devices.find(d => /back|rear|trás|trasera|environment/i.test(d.label || ''));
    this.selectedDevice = back ?? this.devices[0];
    if (this.selectedDevice) {
      console.log('📷 Cámara seleccionada:', this.selectedDevice.label);
    }
  }

  onHasDevices(has: boolean) {
    console.log('📷 Tiene dispositivos:', has);
    if (!has) console.warn('No se detectaron cámaras.');
  }

  onTorchCompatible(compatible: boolean) {
    console.log('🔦 Flash disponible:', compatible);
    this.torchAvailable = compatible;
  }

  onPermissionResponse(permission: boolean) {
    console.log('🔑 Permisos:', permission ? 'Concedidos' : 'Denegados');
    if (!permission) {
      alert('Se requieren permisos de cámara para escanear códigos');
    }
  }

  onDeviceSelectChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const deviceIndex = parseInt(select.value);
    this.selectedDevice = this.devices[deviceIndex];
    console.log('📷 Cambiando a cámara:', this.selectedDevice?.label);
  }

  onScanSuccess(result: any) {
    // El result puede tener más información que solo el texto
    const text = typeof result === 'string' ? result : result.text || result.getText();
    const format = typeof result === 'object' ? result.format || 'Unknown' : 'Unknown';
    
    const cleaned = text.replace(/^\*+|\*+$/g, '').trim();
    
    // Guardar en la lista de todos los códigos
    this.allScannedCodes.unshift({
      text: cleaned,
      format: format,
      timestamp: new Date()
    });
    
    // Mantener solo los últimos 10 códigos
    if (this.allScannedCodes.length > 10) {
      this.allScannedCodes = this.allScannedCodes.slice(0, 10);
    }
    
    console.log('🔍 =================================');
    console.log('🔍 CÓDIGO DETECTADO');
    console.log('🔍 Formato:', format);
    console.log('🔍 Texto completo:', cleaned);
    console.log('🔍 Longitud:', cleaned.length);
    console.log('🔍 Primeros 100 chars:', cleaned.substring(0, 100));
    console.log('🔍 =================================');
    
    // Mostrar siempre el último código leído
    this.lastResult = cleaned;
    this.lastIgnored = null;
    
    // Buscar patrones conocidos dentro del texto
    this.analyzeScannedText(cleaned);
  }

  analyzeScannedText(text: string) {
    console.log('🔍 ANALIZANDO CONTENIDO...');
    
    // Buscar B160495 - STR - 5314 - 1
    const strPattern = /[A-Z]\d{6}\s*-?\s*STR\s*-?\s*\d{4}\s*-?\s*\d+/gi;
    const strMatch = text.match(strPattern);
    if (strMatch) {
      console.log('✅ Encontrado patrón STR:', strMatch);
    }
    
    // Buscar 264019 (No.Doc)
    if (text.includes('264019')) {
      console.log('✅ Encontrado No.Doc: 264019');
    }
    
    // Buscar cualquier secuencia B + 6 dígitos
    const bPattern = /B\d{6}/gi;
    const bMatch = text.match(bPattern);
    if (bMatch) {
      console.log('✅ Encontrado código B:', bMatch);
    }
    
    // Buscar STR
    if (text.toUpperCase().includes('STR')) {
      const strIndex = text.toUpperCase().indexOf('STR');
      const context = text.substring(Math.max(0, strIndex - 20), strIndex + 30);
      console.log('✅ Contexto STR:', context);
    }
    
    // Buscar GPOSADAS
    if (text.includes('GPOSADAS')) {
      console.log('✅ Encontrado: GPOSADAS');
    }
    
    console.log('🔍 ANÁLISIS COMPLETO');
  }

  onScanError(_err: any) {
    // Normal durante el escaneo
  }

  toggleTorch() { 
    this.torchOn = !this.torchOn; 
  }

  logout() { 
    this.auth.logout(); 
  }

  clearHistory() {
    this.allScannedCodes = [];
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      alert('Copiado al portapapeles');
    });
  }
}