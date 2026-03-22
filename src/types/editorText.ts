/** Texto sobreposto ao vídeo (timeline global), estilo editor tipo CapCut. */
export interface EditorTextOverlay {
  id: string;
  text: string;
  /** 0–100: posição horizontal (centro do texto). */
  xPercent: number;
  /** 0–100: posição vertical (centro do texto). */
  yPercent: number;
  fontFamily: string;
  /** Tamanho em px (escala com o preview). */
  fontSize: number;
  color: string;
  fontWeight: 400 | 700;
  /** Início visível na timeline (s). */
  timelineStart: number;
  /** Fim visível na timeline (s). */
  timelineEnd: number;
}
