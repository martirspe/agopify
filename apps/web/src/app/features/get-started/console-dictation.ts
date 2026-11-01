import { signal } from '@angular/core';

/** Minimal Web Speech API surface (Chrome / Edge). */
type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition;

function speechRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * asistente dictation session: mic → DictationBar (Cancelar / waveform / Listo)
 * backed by the browser SpeechRecognition API.
 */
export class ConsoleDictationSession {
  readonly active = signal(false);
  readonly supported = signal(typeof window !== 'undefined' && !!speechRecognitionCtor());
  readonly error = signal<string | null>(null);

  private recognition: BrowserSpeechRecognition | null = null;
  private textBefore = '';
  private finalText = '';
  private restartOnEnd = false;
  private setText: ((value: string) => void) | null = null;

  start(options: { getText: () => string; setText: (value: string) => void }): void {
    if (this.active()) return;
    const Ctor = speechRecognitionCtor();
    if (!Ctor) {
      this.supported.set(false);
      this.error.set('El dictado no está disponible en este navegador.');
      return;
    }

    this.error.set(null);
    this.textBefore = options.getText();
    this.finalText = '';
    this.setText = options.setText;
    this.restartOnEnd = false;

    const recognition = new Ctor();
    recognition.lang = 'es-PE';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let interim = '';
      let finalChunk = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? '';
        if (result.isFinal) finalChunk += text;
        else interim += text;
      }
      if (finalChunk) this.finalText = `${this.finalText}${finalChunk}`.replace(/\s+/g, ' ');
      const base = this.textBefore.trimEnd();
      const spoken = `${this.finalText}${interim}`.trim();
      options.setText(base && spoken ? `${base} ${spoken}` : base || spoken);
    };
    recognition.onerror = (event) => {
      if (event.error === 'aborted' || event.error === 'no-speech') return;
      this.error.set(
        event.error === 'not-allowed'
          ? 'Permite el micrófono para dictar.'
          : 'No se pudo completar el dictado.',
      );
      this.teardown(true);
    };
    recognition.onend = () => {
      if (this.restartOnEnd) {
        try {
          recognition.start();
        } catch {
          this.active.set(false);
          this.recognition = null;
        }
        return;
      }
      this.active.set(false);
      this.recognition = null;
    };

    try {
      recognition.start();
      this.recognition = recognition;
      this.restartOnEnd = true;
      this.active.set(true);
    } catch {
      this.error.set('No se pudo iniciar el dictado.');
      this.recognition = null;
      this.active.set(false);
    }
  }

 /** «Cancelar dictado». */
  cancel(): void {
    this.setText?.(this.textBefore);
    this.teardown(true);
  }

 /** «Listo». */
  confirm(): void {
    this.teardown(false);
  }

  destroy(): void {
    this.teardown(true);
  }

  private teardown(abort: boolean): void {
    const recognition = this.recognition;
    this.recognition = null;
    this.restartOnEnd = false;
    this.active.set(false);
    this.setText = null;
    if (!recognition) return;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    try {
      if (abort) recognition.abort();
      else recognition.stop();
    } catch {
      /* already stopped */
    }
  }
}
