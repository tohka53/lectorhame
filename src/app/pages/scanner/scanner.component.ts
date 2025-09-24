import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

@Component({
  selector: 'app-scanner',
  standalone: false,
  templateUrl: './scanner.component.html',
  styleUrls: ['./scanner.component.css']
})
export class ScannerComponent implements OnInit, OnDestroy {
  @ViewChild('video', { static: true }) video!: ElementRef<HTMLVideoElement>;

  lastResult: string | null = null;
  torchOn = false;

  // Habilita los formatos 1D más comunes (el tuyo suele ser Code 128)
  private formats = [
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.CODE_93,
    BarcodeFormat.ITF,
    BarcodeFormat.CODABAR,
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
  ];

  private controls?: IScannerControls;
  private reader: BrowserMultiFormatReader;

  constructor(public auth: AuthService) {
    // Hints: TRY_HARDER + posibles formatos
    const hints = new Map<DecodeHintType, any>();
    hints.set(DecodeHintType.TRY_HARDER, true);
    hints.set(DecodeHintType.POSSIBLE_FORMATS, this.formats);

    // Pasa hints en el constructor; 300ms entre lecturas continuas
   this.reader = new BrowserMultiFormatReader(
  hints,
  { delayBetweenScanSuccess: 300, delayBetweenScanAttempts: 100 } // opcional
);
  }

  async ngOnInit() {
    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: { ideal: 'environment' },
        width:  { ideal: 2560 },  // si tu equipo es modesto, prueba 1920x1080
        height: { ideal: 1440 },
        frameRate: { ideal: 30 }
        // (quitamos focusMode para evitar error de tipos)
      }
    };

    this.controls = await this.reader.decodeFromVideoDevice(
      undefined,
      this.video.nativeElement,
      (result, err, _controls) => {
        if (result) {
          const raw = result.getText()?.replace(/^\*+|\*+$/g, '').trim();
          if (raw) this.lastResult = raw;
        }
        // Los errores de decodificación son normales mientras intenta; no logeamos para no saturar.
      }
    );
  }

  ngOnDestroy(): void {
    try { this.controls?.stop(); } catch {}
    // No llamamos reader.reset(); algunas versiones no lo incluyen.
  }

  async toggleTorch() {
    // Torch si el navegador/track lo soporta (Android Chrome normalmente sí)
    const stream = this.video.nativeElement?.srcObject as MediaStream | null;
    const track = stream?.getVideoTracks()?.[0];

    if (!track) { console.warn('Sin track de video'); return; }

    // Chequeo de capacidades
    const caps = (track as any).getCapabilities ? (track as any).getCapabilities() : null;
    if (caps && 'torch' in caps) {
      const next = !this.torchOn;
      try {
        // Cast a any para evitar errores de tipo TS (propiedad no tipada en MediaTrackConstraintSet)
        await (track as any).applyConstraints({ advanced: [{ torch: next }] } as any);
        this.torchOn = next;
      } catch (e) {
        console.warn('No se pudo activar linterna via constraints:', e);
      }
    } else {
      console.warn('Torch no soportado por este dispositivo/navegador.');
    }
  }
}
