import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AudioLines,
  ChevronDown,
  CirclePlus,
  Disc3,
  Download,
  FastForward,
  FolderOpen,
  Gauge,
  Headphones,
  Import,
  Info,
  Layers3,
  Magnet,
  Mic2,
  Minus,
  Music2,
  Pause,
  Play,
  Plus,
  Copy,
  ClipboardPaste,
  Mic,
  Repeat2,
  SaveAll,
  Link2,
  Redo2,
  Rewind,
  Save,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  Square,
  Trash2,
  Undo2,
  Volume2,
  VolumeX,
  Waves,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import appIconUrl from "../HinanaStudioEcoIcon.png";
import packageInfo from "../package.json";

type Track = {
  id: string;
  name: string;
  color: string;
  gain: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  effects: TrackEffects;
  automation: AutomationPoint[];
};

type TrackEffects = {
  enabled: boolean;
  low: number;
  mid: number;
  high: number;
  compressor: number;
  delay: number;
  reverb: number;
};

type AutomationPoint = {
  time: number;
  gain: number;
  pan: number;
};

type Clip = {
  id: string;
  trackId: string;
  name: string;
  path?: string;
  start: number;
  offset: number;
  duration: number;
  sourceDuration: number;
  gain: number;
  fadeIn: number;
  fadeOut: number;
  peaks: number[];
};

type Project = {
  formatVersion: 1 | 2;
  name: string;
  sampleRate: number;
  bpm: number;
  tracks: Track[];
  clips: Clip[];
  masterGain?: number;
  loop?: { enabled: boolean; start: number; end: number };
  playbackRate?: number;
  metronome?: boolean;
};

type EffectDialogState =
  | { type: "normalize"; targetDb: number }
  | { type: "fadeIn" | "fadeOut"; duration: number };

const TRACK_COLORS = ["#59d9b0", "#a6dc67", "#65b7ff", "#d58de8", "#ff9b78"];
const defaultEffects = (): TrackEffects => ({
  enabled: true,
  low: 0,
  mid: 0,
  high: 0,
  compressor: 0,
  delay: 0,
  reverb: 0,
});
const normalizeTrack = (track: Partial<Track> & Pick<Track, "id" | "name" | "color">): Track => ({
  gain: 1,
  pan: 0,
  muted: false,
  solo: false,
  ...track,
  effects: { ...defaultEffects(), ...track.effects },
  automation: track.automation || [],
});
const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const timeLabel = (value: number, detailed = false) => {
  const safe = Math.max(0, value);
  const minutes = Math.floor(safe / 60);
  const seconds = Math.floor(safe % 60);
  const millis = Math.floor((safe % 1) * 1000);
  return detailed
    ? `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
};
const dbLabel = (gain: number) =>
  gain <= 0.001 ? "-∞" : `${(20 * Math.log10(gain)).toFixed(1)} dB`;

const starterTracks = (): Track[] => [];

const trackForAudio = (name: string, index: number): Track => normalizeTrack({
  id: uid(),
  name: name.replace(/\.[^.]+$/, "") || `오디오 ${index + 1}`,
  color: TRACK_COLORS[index % TRACK_COLORS.length],
  gain: 1,
  pan: 0,
  muted: false,
  solo: false,
});

function Waveform({
  peaks,
  color,
  fadeIn,
  fadeOut,
}: {
  peaks: number[];
  color: string;
  fadeIn: number;
  fadeOut: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      const ratio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, rect.width * ratio);
      canvas.height = Math.max(1, rect.height * ratio);
      const context = canvas.getContext("2d");
      if (!context) return;
      context.scale(ratio, ratio);
      const width = rect.width;
      const height = rect.height;
      context.clearRect(0, 0, width, height);
      context.strokeStyle = color;
      context.globalAlpha = 0.92;
      context.lineWidth = 1;
      const middle = height / 2;
      const step = width / Math.max(1, peaks.length);
      context.beginPath();
      peaks.forEach((peak, index) => {
        const x = index * step;
        const amplitude = Math.max(1, peak * (height * 0.43));
        context.moveTo(x, middle - amplitude);
        context.lineTo(x, middle + amplitude);
      });
      context.stroke();
      context.globalAlpha = 0.18;
      context.fillStyle = color;
      if (fadeIn > 0) {
        const x = clamp(fadeIn * 18, 0, width);
        context.beginPath();
        context.moveTo(0, 0);
        context.lineTo(x, 0);
        context.lineTo(0, height);
        context.closePath();
        context.fill();
      }
      if (fadeOut > 0) {
        const x = clamp(width - fadeOut * 18, 0, width);
        context.beginPath();
        context.moveTo(width, 0);
        context.lineTo(x, 0);
        context.lineTo(width, height);
        context.closePath();
        context.fill();
      }
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [peaks, color, fadeIn, fadeOut]);
  return <canvas ref={ref} className="waveform" />;
}

function Knob({
  value,
  min,
  max,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  label: string;
}) {
  const angle = -135 + ((value - min) / (max - min)) * 270;
  return (
    <label className="knob-control" title={`${label}: ${value.toFixed(2)}`}>
      <span className="knob" style={{ "--knob-angle": `${angle}deg` } as React.CSSProperties}>
        <i />
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={(max - min) / 100}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function encodeWav(buffer: AudioBuffer) {
  const channels = buffer.numberOfChannels;
  const length = buffer.length * channels * 2 + 44;
  const array = new ArrayBuffer(length);
  const view = new DataView(array);
  const write = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index++)
      view.setUint8(offset + index, text.charCodeAt(index));
  };
  write(0, "RIFF");
  view.setUint32(4, length - 8, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, length - 44, true);
  const data = Array.from({ length: channels }, (_, channel) =>
    buffer.getChannelData(channel),
  );
  let offset = 44;
  for (let sample = 0; sample < buffer.length; sample++) {
    for (let channel = 0; channel < channels; channel++) {
      const value = clamp(data[channel][sample], -1, 1);
      view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true);
      offset += 2;
    }
  }
  return array;
}

const makeReverbImpulse = (context: BaseAudioContext) => {
  const length = Math.floor(context.sampleRate * 1.35);
  const impulse = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
    const data = impulse.getChannelData(channel);
    for (let index = 0; index < length; index++)
      data[index] = (Math.random() * 2 - 1) * Math.pow(1 - index / length, 2.6);
  }
  return impulse;
};

export default function App() {
  const [tracks, setTracks] = useState<Track[]>(starterTracks);
  const [clips, setClips] = useState<Clip[]>([]);
  const [projectName, setProjectName] = useState("Untitled Session");
  const [sampleRate, setSampleRate] = useState(48000);
  const [bpm, setBpm] = useState(120);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [snap, setSnap] = useState(true);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [loopStart, setLoopStart] = useState(0);
  const [loopEnd, setLoopEnd] = useState(4);
  const [metronome, setMetronome] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [recording, setRecording] = useState(false);
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
  const [timelineScrollbar, setTimelineScrollbar] = useState({
    left: 0,
    viewport: 1,
    content: 1,
  });
  const [tool, setTool] = useState<"select" | "cut">("select");
  const [notice, setNotice] = useState("오디오 파일을 가져와 세션을 시작하세요.");
  const [exporting, setExporting] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportFormat, setExportFormat] = useState<"wav" | "mp3">("wav");
  const [mp3Bitrate, setMp3Bitrate] = useState(320);
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [recentProjects, setRecentProjects] = useState<string[]>([]);
  const [masterGain, setMasterGain] = useState(0.9);
  const [masterLevel, setMasterLevel] = useState(0.18);
  const [leftTab, setLeftTab] = useState<"media" | "edit" | "effects">("media");
  const [showAbout, setShowAbout] = useState(false);
  const [effectDialog, setEffectDialog] = useState<EffectDialogState | null>(
    null,
  );
  const [panelMenu, setPanelMenu] = useState<{
    x: number;
    y: number;
    tab: "media" | "edit" | "effects";
  } | null>(null);
  const [trackMenu, setTrackMenu] = useState<{
    x: number;
    y: number;
    trackId: string;
  } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const clipsRef = useRef<Clip[]>(clips);
  const tracksRef = useRef<Track[]>(tracks);
  const audioContext = useRef<AudioContext | null>(null);
  const buffers = useRef(new Map<string, AudioBuffer>());
  const activeSources = useRef<AudioBufferSourceNode[]>([]);
  const activeClicks = useRef<OscillatorNode[]>([]);
  const activeTrackNodes = useRef(
    new Map<
      string,
      {
        gain: GainNode;
        pan: StereoPannerNode;
        low: BiquadFilterNode;
        mid: BiquadFilterNode;
        high: BiquadFilterNode;
        compressor: DynamicsCompressorNode;
        delayWet: GainNode;
        reverbWet: GainNode;
      }
    >(),
  );
  const activeClipGainNodes = useRef(new Map<string, GainNode>());
  const activeMasterNode = useRef<GainNode | null>(null);
  const activeAnalyser = useRef<AnalyserNode | null>(null);
  const animation = useRef<number>(0);
  const playbackStarted = useRef({ contextTime: 0, timelineTime: 0 });
  const history = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);
  const restoring = useRef(false);
  const timelineScroll = useRef<HTMLDivElement>(null);
  const timelineScrollbarTrack = useRef<HTMLDivElement>(null);
  const clipboard = useRef<Clip[]>([]);
  const recorder = useRef<MediaRecorder | null>(null);
  const recordingStartedAt = useRef(0);

  const selectedClip = clips.find((clip) => clip.id === selectedClipId);
  const selectedTrack = tracks.find(
    (track) => track.id === (selectedClip?.trackId || selectedTrackId),
  );
  const selectedPeak = selectedClip
    ? Math.max(0, ...selectedClip.peaks) * selectedClip.gain
    : 0;
  const selectedPeakDb =
    selectedPeak > 0 ? 20 * Math.log10(selectedPeak) : -Infinity;
  const totalDuration = useMemo(
    () => Math.max(30, ...clips.map((clip) => clip.start + clip.duration + 2)),
    [clips],
  );
  const pxPerSecond = 54 * zoom;
  const sessionEnd = Math.max(1, ...clips.map((clip) => clip.start + clip.duration));
  const soloActive = tracks.some((track) => track.solo);

  useEffect(() => {
    clipsRef.current = clips;
  }, [clips]);

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  useEffect(() => {
    void window.hinanaEco?.recentProjects().then(setRecentProjects);
  }, []);

  const serialize = useCallback(
    (): Project => ({
      formatVersion: 2,
      name: projectName,
      sampleRate,
      bpm,
      tracks,
      clips,
      masterGain,
      loop: { enabled: loopEnabled, start: loopStart, end: loopEnd },
      playbackRate,
      metronome,
    }),
    [
      bpm,
      clips,
      loopEnabled,
      loopEnd,
      loopStart,
      masterGain,
      metronome,
      playbackRate,
      projectName,
      sampleRate,
      tracks,
    ],
  );

  useEffect(() => {
    if (restoring.current) return;
    const timer = window.setTimeout(() => {
      const snapshot = JSON.stringify(serialize());
      if (history.current[history.current.length - 1] !== snapshot) {
        history.current.push(snapshot);
        if (history.current.length > 60) history.current.shift();
        redoStack.current = [];
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [serialize]);

  useEffect(() => {
    if (restoring.current || !clips.length) return;
    const timer = window.setTimeout(() => {
      localStorage.setItem("hinana-eco:autosave", JSON.stringify(serialize()));
      localStorage.setItem("hinana-eco:autosave-time", new Date().toISOString());
    }, 1200);
    return () => clearTimeout(timer);
  }, [clips.length, serialize]);

  useEffect(() => {
    const raw = localStorage.getItem("hinana-eco:autosave");
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as Project;
      if (!saved.clips?.length) return;
      restore(raw);
      history.current = [raw];
      setNotice("자동 저장된 마지막 세션을 복구했습니다.");
    } catch {
      localStorage.removeItem("hinana-eco:autosave");
    }
    // Recovery is intentionally performed only once at startup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const restore = (raw: string) => {
    restoring.current = true;
    const project = JSON.parse(raw) as Project;
    setProjectName(project.name);
    setSampleRate(project.sampleRate);
    setBpm(project.bpm);
    setTracks(project.tracks.map(normalizeTrack));
    setClips(project.clips);
    setMasterGain(project.masterGain ?? 0.9);
    setLoopEnabled(project.loop?.enabled ?? false);
    setLoopStart(project.loop?.start ?? 0);
    setLoopEnd(project.loop?.end ?? 4);
    setPlaybackRate(project.playbackRate ?? 1);
    setMetronome(project.metronome ?? false);
    setSelectedClipId(null);
    setSelectedClipIds([]);
    window.setTimeout(() => {
      restoring.current = false;
    });
  };

  const undo = () => {
    if (history.current.length < 2) return;
    redoStack.current.push(history.current.pop()!);
    restore(history.current[history.current.length - 1]!);
  };
  const redo = () => {
    const next = redoStack.current.pop();
    if (!next) return;
    history.current.push(next);
    restore(next);
  };

  const getContext = () => {
    if (!audioContext.current)
      audioContext.current = new AudioContext({ sampleRate });
    return audioContext.current;
  };

  const makePeaks = (buffer: AudioBuffer, count = 420) => {
    const data = buffer.getChannelData(0);
    const stride = Math.max(1, Math.floor(data.length / count));
    return Array.from({ length: count }, (_, index) => {
      let peak = 0;
      const end = Math.min(data.length, (index + 1) * stride);
      for (let cursor = index * stride; cursor < end; cursor += 4)
        peak = Math.max(peak, Math.abs(data[cursor]));
      return peak;
    });
  };

  const decodePath = async (clip: Clip) => {
    if (buffers.current.has(clip.id)) return buffers.current.get(clip.id)!;
    if (!clip.path || !window.hinanaEco)
      throw new Error(`${clip.name}의 원본 파일을 찾을 수 없습니다.`);
    const raw = await window.hinanaEco.readAudio(clip.path);
    const buffer = await getContext().decodeAudioData(raw.slice(0));
    buffers.current.set(clip.id, buffer);
    return buffer;
  };

  const importFiles = async (files: FileList | File[]) => {
    const incoming = Array.from(files).filter(
      (file) =>
        file.type.startsWith("audio/") ||
        /\.(wav|mp3|m4a|aac|ogg|flac)$/i.test(file.name),
    );
    if (!incoming.length) {
      setNotice("지원하는 오디오 파일을 선택해 주세요.");
      return;
    }
    setNotice(`${incoming.length}개 파일을 분석하고 있습니다…`);
    const context = getContext();
    const added: Clip[] = [];
    const createdTracks: Track[] = [];
    for (let index = 0; index < incoming.length; index++) {
      const file = incoming[index];
      try {
        const buffer = await context.decodeAudioData(await file.arrayBuffer());
        const target = trackForAudio(file.name, tracks.length + createdTracks.length);
        createdTracks.push(target);
        const id = uid();
        buffers.current.set(id, buffer);
        added.push({
          id,
          trackId: target.id,
          name: file.name.replace(/\.[^.]+$/, ""),
          path: window.hinanaEco?.getFilePath(file),
          start: 0,
          offset: 0,
          duration: buffer.duration,
          sourceDuration: buffer.duration,
          gain: 1,
          fadeIn: 0,
          fadeOut: 0,
          peaks: makePeaks(buffer),
        });
      } catch {
        setNotice(`${file.name}을 읽지 못했습니다.`);
      }
    }
    if (added.length) {
      setTracks((items) => [...items, ...createdTracks]);
      setClips((items) => [...items, ...added]);
      setSelectedClipId(added[0].id);
      setSelectedClipIds([added[0].id]);
      setSelectedTrackId(added[0].trackId);
      setNotice(`${added.length}개 파일을 세션에 추가했습니다.`);
    }
  };

  const importFromDesktop = async () => {
    if (!window.hinanaEco) {
      fileInput.current?.click();
      return;
    }
    const selected = await window.hinanaEco.selectAudioFiles();
    if (!selected.length) {
      setNotice("파일 선택을 취소했습니다.");
      return;
    }
    setNotice(`${selected.length}개 오디오 파일을 분석하고 있습니다…`);
    const context = getContext();
    const added: Clip[] = [];
    const createdTracks: Track[] = [];
    const failures: string[] = [];
    for (let index = 0; index < selected.length; index++) {
      const file = selected[index];
      try {
        const raw = await window.hinanaEco.readAudio(file.path);
        const buffer = await context.decodeAudioData(raw.slice(0));
        const target = trackForAudio(file.name, tracks.length + createdTracks.length);
        createdTracks.push(target);
        const id = uid();
        buffers.current.set(id, buffer);
        added.push({
          id,
          trackId: target.id,
          name: file.name.replace(/\.[^.]+$/, ""),
          path: file.path,
          start: 0,
          offset: 0,
          duration: buffer.duration,
          sourceDuration: buffer.duration,
          gain: 1,
          fadeIn: 0,
          fadeOut: 0,
          peaks: makePeaks(buffer),
        });
      } catch {
        failures.push(file.name);
      }
    }
    if (added.length) {
      setTracks((items) => [...items, ...createdTracks]);
      setClips((items) => [...items, ...added]);
      setSelectedClipId(added[0].id);
      setSelectedClipIds([added[0].id]);
      setSelectedTrackId(added[0].trackId);
      setNotice(
        failures.length
          ? `${added.length}개를 추가했고 ${failures.length}개는 읽지 못했습니다.`
          : `${added.length}개 오디오 파일을 세션에 추가했습니다.`,
      );
    } else {
      setNotice(
        failures.length
          ? `파일을 읽지 못했습니다: ${failures.join(", ")}`
          : "가져올 수 있는 오디오 파일이 없습니다.",
      );
    }
  };

  const stopSources = () => {
    activeSources.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        // The node may already have ended.
      }
    });
    activeSources.current = [];
    activeClicks.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        // The click may already have ended.
      }
    });
    activeClicks.current = [];
    activeClipGainNodes.current.clear();
    activeTrackNodes.current.forEach(({ gain, pan }) => {
      gain.disconnect();
      pan.disconnect();
    });
    activeTrackNodes.current.clear();
    activeMasterNode.current?.disconnect();
    activeAnalyser.current?.disconnect();
    activeMasterNode.current = null;
    activeAnalyser.current = null;
    setMasterLevel(0);
  };

  const schedulePlayback = async (from: number) => {
    const context = getContext();
    await context.resume();
    stopSources();
    const scheduledClips = clipsRef.current;
    const scheduledTracks = tracksRef.current;
    const scheduledSoloActive = scheduledTracks.some((track) => track.solo);
    const master = context.createGain();
    master.gain.value = masterGain;
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.72;
    master.connect(analyser).connect(context.destination);
    activeMasterNode.current = master;
    activeAnalyser.current = analyser;

    if (metronome) {
      const beatLength = 60 / bpm;
      const end = loopEnabled ? loopEnd : sessionEnd;
      const firstBeat = Math.ceil(from / beatLength);
      for (let beat = firstBeat; beat * beatLength < end; beat++) {
        const oscillator = context.createOscillator();
        const clickGain = context.createGain();
        const when =
          context.currentTime + (beat * beatLength - from) / playbackRate;
        oscillator.frequency.value = beat % 4 === 0 ? 1320 : 880;
        clickGain.gain.setValueAtTime(0.0001, when);
        clickGain.gain.exponentialRampToValueAtTime(0.15, when + 0.002);
        clickGain.gain.exponentialRampToValueAtTime(0.0001, when + 0.045);
        oscillator.connect(clickGain).connect(master);
        oscillator.start(when);
        oscillator.stop(when + 0.05);
        activeClicks.current.push(oscillator);
      }
    }

    const trackNodes = new Map<
      string,
      {
        gain: GainNode;
        pan: StereoPannerNode;
        low: BiquadFilterNode;
        mid: BiquadFilterNode;
        high: BiquadFilterNode;
        compressor: DynamicsCompressorNode;
        delayWet: GainNode;
        reverbWet: GainNode;
      }
    >();
    scheduledTracks.forEach((track) => {
      const trackGain = context.createGain();
      const low = context.createBiquadFilter();
      const mid = context.createBiquadFilter();
      const high = context.createBiquadFilter();
      const compressor = context.createDynamicsCompressor();
      const trackPan = context.createStereoPanner();
      const delay = context.createDelay(1);
      const delayWet = context.createGain();
      const convolver = context.createConvolver();
      const reverbWet = context.createGain();
      const audible =
        !track.muted && (!scheduledSoloActive || track.solo);
      trackGain.gain.value = audible ? track.gain : 0;
      low.type = "lowshelf";
      low.frequency.value = 180;
      low.gain.value = track.effects.enabled ? track.effects.low : 0;
      mid.type = "peaking";
      mid.frequency.value = 1200;
      mid.Q.value = 0.8;
      mid.gain.value = track.effects.enabled ? track.effects.mid : 0;
      high.type = "highshelf";
      high.frequency.value = 6200;
      high.gain.value = track.effects.enabled ? track.effects.high : 0;
      compressor.threshold.value = -12 - track.effects.compressor * 28;
      compressor.ratio.value = track.effects.enabled
        ? 1 + track.effects.compressor * 11
        : 1;
      trackPan.pan.value = track.pan;
      delay.delayTime.value = 0.28;
      delayWet.gain.value = track.effects.enabled ? track.effects.delay : 0;
      convolver.buffer = makeReverbImpulse(context);
      reverbWet.gain.value = track.effects.enabled ? track.effects.reverb : 0;
      trackGain.connect(low).connect(mid).connect(high).connect(compressor).connect(trackPan);
      trackPan.connect(master);
      trackPan.connect(delay).connect(delayWet).connect(master);
      trackPan.connect(convolver).connect(reverbWet).connect(master);

      const points = [...track.automation].sort((a, b) => a.time - b.time);
      const previous = [...points].reverse().find((point) => point.time <= from);
      if (previous) {
        trackGain.gain.value = audible ? previous.gain : 0;
        trackPan.pan.value = previous.pan;
      }
      points
        .filter((point) => point.time > from)
        .forEach((point) => {
          const when = context.currentTime + (point.time - from) / playbackRate;
          trackGain.gain.linearRampToValueAtTime(audible ? point.gain : 0, when);
          trackPan.pan.linearRampToValueAtTime(point.pan, when);
        });
      trackNodes.set(track.id, {
        gain: trackGain,
        pan: trackPan,
        low,
        mid,
        high,
        compressor,
        delayWet,
        reverbWet,
      });
    });
    activeTrackNodes.current = trackNodes;

    const sources: AudioBufferSourceNode[] = [];
    for (const clip of scheduledClips) {
      const track = scheduledTracks.find((item) => item.id === clip.trackId);
      const trackNode = trackNodes.get(clip.trackId);
      if (!track || !trackNode) continue;
      const clipEnd = clip.start + clip.duration;
      if (clipEnd <= from) continue;
      try {
        const buffer = await decodePath(clip);
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = playbackRate;
        const gain = context.createGain();
        const beginsAt = Math.max(from, clip.start);
        const local = clip.offset + Math.max(0, from - clip.start);
        const timelineEnd = loopEnabled ? Math.min(clipEnd, loopEnd) : clipEnd;
        const duration = timelineEnd - beginsAt;
        if (duration <= 0) continue;
        const startAt =
          context.currentTime + Math.max(0, clip.start - from) / playbackRate;
        const baseGain = clip.gain;
        gain.gain.setValueAtTime(baseGain, startAt);
        if (clip.fadeIn > 0) {
          const fadeEnd = clip.start + clip.fadeIn;
          if (beginsAt < fadeEnd) {
            const ratio = clamp((beginsAt - clip.start) / clip.fadeIn, 0, 1);
            gain.gain.setValueAtTime(baseGain * ratio, startAt);
            gain.gain.linearRampToValueAtTime(
              baseGain,
              startAt + (fadeEnd - beginsAt) / playbackRate,
            );
          }
        }
        if (clip.fadeOut > 0) {
          const fadeStart = clipEnd - clip.fadeOut;
          const localFadeStart = Math.max(beginsAt, fadeStart);
          gain.gain.setValueAtTime(
            localFadeStart > fadeStart
              ? baseGain * ((clipEnd - localFadeStart) / clip.fadeOut)
              : baseGain,
            startAt + (localFadeStart - beginsAt) / playbackRate,
          );
          gain.gain.linearRampToValueAtTime(
            0,
            startAt + duration / playbackRate,
          );
        }
        source.connect(gain).connect(trackNode.gain);
        activeClipGainNodes.current.set(clip.id, gain);
        source.start(startAt, local, duration);
        sources.push(source);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "재생 준비에 실패했습니다.");
      }
    }
    activeSources.current = sources;
    playbackStarted.current = {
      contextTime: context.currentTime,
      timelineTime: from,
    };
    setPlaying(true);
  };

  const togglePlayback = () => {
    if (playing) {
      const context = getContext();
      const next =
        playbackStarted.current.timelineTime +
        (context.currentTime - playbackStarted.current.contextTime) *
          playbackRate;
      setPlayhead(clamp(next, 0, totalDuration));
      setPlaying(false);
      stopSources();
    } else {
      const start =
        loopEnabled && (playhead < loopStart || playhead >= loopEnd)
          ? loopStart
          : playhead >= sessionEnd
            ? 0
            : playhead;
      setPlayhead(start);
      void schedulePlayback(start);
    }
  };

  useEffect(() => {
    if (!playing) return;
    const tick = () => {
      const context = getContext();
      const next =
        playbackStarted.current.timelineTime +
        (context.currentTime - playbackStarted.current.contextTime) *
          playbackRate;
      setPlayhead(next);
      const analyser = activeAnalyser.current;
      if (analyser) {
        const samples = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(samples);
        let squareSum = 0;
        for (const sample of samples) squareSum += sample * sample;
        const rms = Math.sqrt(squareSum / samples.length);
        setMasterLevel(clamp(rms * 3.8, 0, 1));
      }
      if (loopEnabled && next >= loopEnd) {
        setPlayhead(loopStart);
        void schedulePlayback(loopStart).then(() => {
          animation.current = requestAnimationFrame(tick);
        });
        return;
      }
      if (next >= sessionEnd) {
        setPlaying(false);
        stopSources();
        setPlayhead(0);
        return;
      }
      animation.current = requestAnimationFrame(tick);
    };
    animation.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animation.current);
  }, [loopEnabled, loopEnd, loopStart, playbackRate, playing, sessionEnd]);

  useEffect(() => {
    const context = audioContext.current;
    if (!context || !activeTrackNodes.current.size) return;
    const anySolo = tracks.some((track) => track.solo);
    for (const track of tracks) {
      const node = activeTrackNodes.current.get(track.id);
      if (!node) continue;
      const audible = !track.muted && (!anySolo || track.solo);
      node.gain.gain.setTargetAtTime(
        audible ? track.gain : 0,
        context.currentTime,
        0.012,
      );
      node.pan.pan.setTargetAtTime(track.pan, context.currentTime, 0.012);
      const amount = track.effects.enabled ? 1 : 0;
      node.low.gain.setTargetAtTime(track.effects.low * amount, context.currentTime, 0.012);
      node.mid.gain.setTargetAtTime(track.effects.mid * amount, context.currentTime, 0.012);
      node.high.gain.setTargetAtTime(track.effects.high * amount, context.currentTime, 0.012);
      node.compressor.threshold.setTargetAtTime(
        -12 - track.effects.compressor * 28,
        context.currentTime,
        0.012,
      );
      node.compressor.ratio.setTargetAtTime(
        track.effects.enabled ? 1 + track.effects.compressor * 11 : 1,
        context.currentTime,
        0.012,
      );
      node.delayWet.gain.setTargetAtTime(
        track.effects.delay * amount,
        context.currentTime,
        0.012,
      );
      node.reverbWet.gain.setTargetAtTime(
        track.effects.reverb * amount,
        context.currentTime,
        0.012,
      );
    }
  }, [tracks]);

  useEffect(() => {
    const context = audioContext.current;
    const master = activeMasterNode.current;
    if (!context || !master) return;
    master.gain.setTargetAtTime(masterGain, context.currentTime, 0.012);
  }, [masterGain]);

  useEffect(() => {
    const context = audioContext.current;
    if (!context || !activeClipGainNodes.current.size) return;
    clips.forEach((clip) => {
      const node = activeClipGainNodes.current.get(clip.id);
      if (!node) return;
      node.gain.setTargetAtTime(clip.gain, context.currentTime, 0.012);
    });
  }, [clips]);

  useEffect(() => {
    const scroller = timelineScroll.current;
    if (!scroller || scroller.clientWidth <= 0) return;
    const playheadX = playhead * pxPerSecond;
    const visibleLeft = scroller.scrollLeft;
    const visibleWidth = scroller.clientWidth;
    const leftGuard = visibleLeft + Math.min(42, visibleWidth * 0.12);
    const rightGuard = visibleLeft + visibleWidth * 0.8;

    if (playheadX > rightGuard) {
      scroller.scrollLeft = Math.max(0, playheadX - visibleWidth * 0.35);
    } else if (playheadX < leftGuard) {
      scroller.scrollLeft = Math.max(0, playheadX - visibleWidth * 0.12);
    }
  }, [playhead, pxPerSecond]);

  useEffect(() => {
    const scroller = timelineScroll.current;
    if (!scroller) return;
    const sync = () =>
      setTimelineScrollbar({
        left: scroller.scrollLeft,
        viewport: scroller.clientWidth,
        content: Math.max(scroller.clientWidth, scroller.scrollWidth),
      });
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(scroller);
    if (scroller.firstElementChild) observer.observe(scroller.firstElementChild);
    scroller.addEventListener("scroll", sync, { passive: true });
    return () => {
      observer.disconnect();
      scroller.removeEventListener("scroll", sync);
    };
  }, [pxPerSecond, totalDuration, tracks.length]);

  const updateClip = (id: string, changes: Partial<Clip>) =>
    setClips((items) => {
      const next = items.map((clip) =>
        clip.id === id ? { ...clip, ...changes } : clip,
      );
      clipsRef.current = next;
      return next;
    });
  const updateTrack = (id: string, changes: Partial<Track>) =>
    setTracks((items) => {
      const next = items.map((track) =>
        track.id === id ? { ...track, ...changes } : track,
      );
      tracksRef.current = next;
      return next;
    });
  const updateTrackEffect = (
    id: string,
    key: keyof TrackEffects,
    value: number | boolean,
  ) => {
    const track = tracksRef.current.find((item) => item.id === id);
    if (!track) return;
    updateTrack(id, { effects: { ...track.effects, [key]: value } });
  };
  const addAutomationPoint = (track: Track) => {
    const point = { time: playhead, gain: track.gain, pan: track.pan };
    updateTrack(track.id, {
      automation: [
        ...track.automation.filter((item) => Math.abs(item.time - playhead) > 0.02),
        point,
      ].sort((a, b) => a.time - b.time),
    });
    setNotice(`${timeLabel(playhead, true)}에 볼륨·팬 자동화 지점을 추가했습니다.`);
  };

  const openEffectDialog = (type: "normalize" | "fadeIn" | "fadeOut") => {
    if (!selectedClip) {
      setNotice("효과를 적용할 클립을 먼저 선택하세요.");
      setPanelMenu(null);
      return;
    }
    if (playing) togglePlayback();
    setEffectDialog(
      type === "normalize"
        ? { type, targetDb: -1 }
        : {
            type,
            duration:
              type === "fadeIn"
                ? selectedClip.fadeIn || Math.min(1, selectedClip.duration / 2)
                : selectedClip.fadeOut || Math.min(1, selectedClip.duration / 2),
          },
    );
    setPanelMenu(null);
  };

  const applyEffect = () => {
    if (!selectedClip || !effectDialog) return;
    if (effectDialog.type === "normalize") {
      const buffer = buffers.current.get(selectedClip.id);
      let peak = 0;
      if (buffer) {
        const firstSample = Math.floor(
          selectedClip.offset * buffer.sampleRate,
        );
        const lastSample = Math.min(
          buffer.length,
          Math.ceil(
            (selectedClip.offset + selectedClip.duration) * buffer.sampleRate,
          ),
        );
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
          const samples = buffer.getChannelData(channel);
          for (let index = firstSample; index < lastSample; index++)
            peak = Math.max(peak, Math.abs(samples[index]));
        }
      } else {
        peak = Math.max(0, ...selectedClip.peaks);
      }
      if (peak <= 0.000001) {
        setNotice("무음 클립은 노멀라이즈할 수 없습니다.");
        return;
      }
      const targetAmplitude = Math.pow(10, effectDialog.targetDb / 20);
      const normalizedGain = targetAmplitude / peak;
      updateClip(selectedClip.id, { gain: normalizedGain });
      setNotice(
        `${selectedClip.name}을 ${effectDialog.targetDb.toFixed(1)} dBFS 피크로 노멀라이즈했습니다.`,
      );
    } else {
      const duration = clamp(
        effectDialog.duration,
        0,
        selectedClip.duration,
      );
      updateClip(
        selectedClip.id,
        effectDialog.type === "fadeIn"
          ? { fadeIn: duration }
          : { fadeOut: duration },
      );
      setNotice(
        `${selectedClip.name}에 ${duration.toFixed(2)}초 ${
          effectDialog.type === "fadeIn" ? "페이드 인" : "페이드 아웃"
        }을 적용했습니다.`,
      );
    }
    setEffectDialog(null);
  };

  const splitAt = (clipToSplit: Clip, splitTime: number) => {
    const relative = splitTime - clipToSplit.start;
    if (relative <= 0.03 || relative >= clipToSplit.duration - 0.03) {
      setNotice("재생 헤드를 선택한 클립 안에 놓아 주세요.");
      return;
    }
    const rightId = uid();
    const buffer = buffers.current.get(clipToSplit.id);
    if (buffer) buffers.current.set(rightId, buffer);
    const left: Clip = { ...clipToSplit, duration: relative };
    const right: Clip = {
      ...clipToSplit,
      id: rightId,
      name: `${clipToSplit.name} · B`,
      start: splitTime,
      offset: clipToSplit.offset + relative,
      duration: clipToSplit.duration - relative,
      fadeIn: 0,
    };
    setClips((items) =>
      items.flatMap((clip) => (clip.id === clipToSplit.id ? [left, right] : clip)),
    );
    setSelectedClipId(rightId);
    setSelectedClipIds([rightId]);
    setNotice("클립을 재생 헤드에서 분할했습니다.");
  };
  const splitClip = () => {
    if (selectedClip) splitAt(selectedClip, playhead);
  };

  const toggleCutTool = () => {
    if (tool === "cut") {
      setTool("select");
      setNotice("자르기 도구를 취소했습니다.");
    } else {
      setTool("cut");
      setNotice("자를 위치를 클립 위에서 한 번 클릭하세요. Esc로 취소할 수 있습니다.");
    }
  };

  const deleteSelected = () => {
    const ids = selectedClipIds.length
      ? selectedClipIds
      : selectedClipId
        ? [selectedClipId]
        : [];
    if (!ids.length) return;
    ids.forEach((id) => buffers.current.delete(id));
    setClips((items) => items.filter((clip) => !ids.includes(clip.id)));
    setSelectedClipId(null);
    setSelectedClipIds([]);
    setNotice(`${ids.length}개 클립을 삭제했습니다.`);
  };

  const rippleDeleteSelected = () => {
    const ids = selectedClipIds.length
      ? selectedClipIds
      : selectedClipId
        ? [selectedClipId]
        : [];
    if (!ids.length) return;
    const removed = clips.filter((clip) => ids.includes(clip.id));
    const byTrack = new Map<string, { start: number; end: number }>();
    removed.forEach((clip) => {
      const range = byTrack.get(clip.trackId);
      byTrack.set(clip.trackId, {
        start: Math.min(range?.start ?? Infinity, clip.start),
        end: Math.max(range?.end ?? 0, clip.start + clip.duration),
      });
      buffers.current.delete(clip.id);
    });
    setClips((items) =>
      items
        .filter((clip) => !ids.includes(clip.id))
        .map((clip) => {
          const range = byTrack.get(clip.trackId);
          if (!range || clip.start < range.end) return clip;
          return { ...clip, start: Math.max(range.start, clip.start - (range.end - range.start)) };
        }),
    );
    setSelectedClipId(null);
    setSelectedClipIds([]);
    setNotice(`${ids.length}개 클립을 리플 삭제했습니다.`);
  };

  const copySelected = () => {
    const ids = selectedClipIds.length
      ? selectedClipIds
      : selectedClipId
        ? [selectedClipId]
        : [];
    clipboard.current = clips.filter((clip) => ids.includes(clip.id));
    setNotice(`${clipboard.current.length}개 클립을 복사했습니다.`);
  };

  const pasteClips = (at = playhead) => {
    if (!clipboard.current.length) return;
    const first = Math.min(...clipboard.current.map((clip) => clip.start));
    const pasted = clipboard.current.map((clip) => {
      const id = uid();
      const source = buffers.current.get(clip.id);
      if (source) buffers.current.set(id, source);
      return {
        ...clip,
        id,
        name: `${clip.name} · 복사본`,
        start: Math.max(0, at + clip.start - first),
      };
    });
    setClips((items) => [...items, ...pasted]);
    setSelectedClipId(pasted[0].id);
    setSelectedClipIds(pasted.map((clip) => clip.id));
    setSelectedTrackId(pasted[0].trackId);
    setNotice(`${pasted.length}개 클립을 붙여넣었습니다.`);
  };

  const duplicateSelected = () => {
    copySelected();
    const chosen = clipboard.current;
    if (!chosen.length) return;
    const end = Math.max(...chosen.map((clip) => clip.start + clip.duration));
    pasteClips(end);
  };

  const deleteTrack = (trackId: string) => {
    const target = tracks.find((track) => track.id === trackId);
    const clipIds = clips
      .filter((clip) => clip.trackId === trackId)
      .map((clip) => clip.id);
    clipIds.forEach((id) => buffers.current.delete(id));
    setClips((items) => items.filter((clip) => clip.trackId !== trackId));
    setTracks((items) => items.filter((track) => track.id !== trackId));
    if (selectedTrackId === trackId) setSelectedTrackId(null);
    if (selectedClip?.trackId === trackId) {
      setSelectedClipId(null);
      setSelectedClipIds([]);
    }
    setTrackMenu(null);
    setNotice(
      clipIds.length
        ? `${target?.name || "트랙"}과 포함된 클립 ${clipIds.length}개를 삭제했습니다.`
        : `${target?.name || "트랙"}을 삭제했습니다.`,
    );
  };

  const deleteCurrentSelection = () => {
    if (selectedClipId) deleteSelected();
    else if (selectedTrackId) deleteTrack(selectedTrackId);
  };

  const addTrack = () => {
    const index = tracks.length;
    const track: Track = normalizeTrack({
      id: uid(),
      name: `오디오 ${index + 1}`,
      color: TRACK_COLORS[index % TRACK_COLORS.length],
      gain: 1,
      pan: 0,
      muted: false,
      solo: false,
    });
    setTracks((items) => [...items, track]);
    setSelectedTrackId(track.id);
  };

  const stopRecording = () => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  };

  const startRecording = async () => {
    if (recording) {
      stopRecording();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const mediaRecorder = new MediaRecorder(stream);
      recorder.current = mediaRecorder;
      recordingStartedAt.current = playhead;
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        try {
          const raw = await new Blob(chunks, { type: mediaRecorder.mimeType }).arrayBuffer();
          const buffer = await getContext().decodeAudioData(raw.slice(0));
          const wav = encodeWav(buffer);
          const path = window.hinanaEco
            ? await window.hinanaEco.saveRecording(
                wav,
                `Recording-${new Date().toISOString().replace(/[:.]/g, "-")}.wav`,
              )
            : undefined;
          let target = tracksRef.current.find((track) => track.id === selectedTrackId);
          if (!target) {
            target = trackForAudio("Recording", tracksRef.current.length);
            setTracks((items) => [...items, target!]);
          }
          const id = uid();
          buffers.current.set(id, buffer);
          const clip: Clip = {
            id,
            trackId: target.id,
            name: `Recording ${new Date().toLocaleTimeString()}`,
            path,
            start: recordingStartedAt.current,
            offset: 0,
            duration: buffer.duration,
            sourceDuration: buffer.duration,
            gain: 1,
            fadeIn: 0,
            fadeOut: 0,
            peaks: makePeaks(buffer),
          };
          setClips((items) => [...items, clip]);
          setSelectedClipId(id);
          setSelectedClipIds([id]);
          setSelectedTrackId(target.id);
          setNotice(`${buffer.duration.toFixed(1)}초 녹음을 추가했습니다.`);
        } catch (error) {
          setNotice(error instanceof Error ? error.message : "녹음을 처리하지 못했습니다.");
        }
      };
      mediaRecorder.start();
      setRecording(true);
      setNotice("마이크 녹음 중입니다. 녹음 버튼을 다시 눌러 종료하세요.");
    } catch {
      setNotice("마이크 사용 권한을 허용해야 녹음할 수 있습니다.");
    }
  };

  const saveProject = async (saveAs = false) => {
    if (!window.hinanaEco) {
      setNotice("데스크톱 앱에서 프로젝트 저장을 사용할 수 있습니다.");
      return;
    }
    setNotice("프로젝트와 원본 오디오를 패키지로 저장하고 있습니다…");
    try {
      const path = await window.hinanaEco.saveProject(
        JSON.stringify(serialize(), null, 2),
        saveAs,
      );
      if (path) {
        setProjectPath(path);
        setRecentProjects(await window.hinanaEco.recentProjects());
        setNotice("원본 오디오를 포함한 프로젝트 패키지를 저장했습니다.");
      } else {
        setNotice("프로젝트 저장을 취소했습니다.");
      }
    } catch (error) {
      setNotice(
        error instanceof Error
          ? `프로젝트 저장 실패: ${error.message}`
          : "프로젝트 저장에 실패했습니다.",
      );
    }
  };

  const loadProjectResult = async (result: { path: string; data: string }) => {
      const desktop = window.hinanaEco;
      stopSources();
      setPlaying(false);
      buffers.current.clear();
      const project = JSON.parse(result.data) as Project;
      const hydrated: Clip[] = [];
      for (const clip of project.clips) {
        try {
          if (!clip.path) throw new Error();
          if (!desktop) throw new Error();
          const raw = await desktop.readAudio(clip.path);
          const buffer = await getContext().decodeAudioData(raw.slice(0));
          buffers.current.set(clip.id, buffer);
          hydrated.push({
            ...clip,
            peaks: clip.peaks?.length ? clip.peaks : makePeaks(buffer),
          });
        } catch {
          hydrated.push(clip);
        }
      }
      restore(JSON.stringify({ ...project, clips: hydrated }));
      history.current = [JSON.stringify({ ...project, clips: hydrated })];
      setProjectPath(result.path);
      setRecentProjects(await desktop?.recentProjects() || []);
      setNotice("프로젝트 패키지와 포함된 오디오를 열었습니다.");
  };

  const openProject = async () => {
    if (!window.hinanaEco) return;
    try {
      const result = await window.hinanaEco.openProject();
      if (!result) return;
      await loadProjectResult(result);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? `프로젝트 열기 실패: ${error.message}`
          : "프로젝트를 열지 못했습니다.",
      );
    }
  };

  const openRecentProject = async (path: string) => {
    if (!window.hinanaEco) return;
    try {
      await loadProjectResult(await window.hinanaEco.openRecentProject(path));
    } catch (error) {
      setRecentProjects(await window.hinanaEco.recentProjects());
      setNotice(error instanceof Error ? error.message : "최근 프로젝트를 열지 못했습니다.");
    }
  };

  const backupProject = async () => {
    if (!window.hinanaEco) return;
    try {
      const path = await window.hinanaEco.backupProject(
        JSON.stringify(serialize(), null, 2),
      );
      setNotice(`백업을 생성했습니다: ${path}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "백업을 생성하지 못했습니다.");
    }
  };

  const relinkSelectedClip = async () => {
    if (!selectedClip || !window.hinanaEco) return;
    const path = await window.hinanaEco.relinkAudio();
    if (!path) return;
    try {
      const raw = await window.hinanaEco.readAudio(path);
      const buffer = await getContext().decodeAudioData(raw.slice(0));
      buffers.current.set(selectedClip.id, buffer);
      updateClip(selectedClip.id, {
        path,
        offset: 0,
        duration: buffer.duration,
        sourceDuration: buffer.duration,
        peaks: makePeaks(buffer),
      });
      setNotice(`${selectedClip.name}의 원본 미디어를 다시 연결했습니다.`);
    } catch {
      setNotice("선택한 오디오 파일을 읽지 못했습니다.");
    }
  };

  const exportMix = async (
    format: "wav" | "mp3" = exportFormat,
    bitrate = mp3Bitrate,
  ) => {
    if (!clips.length) {
      setNotice("내보낼 오디오가 없습니다.");
      return;
    }
    setShowExportDialog(false);
    setExporting(true);
    setNotice(
      format === "mp3"
        ? `믹스를 렌더링한 뒤 MP3 ${bitrate} kbps로 인코딩하고 있습니다…`
        : "무손실 WAV 믹스를 렌더링하고 있습니다…",
    );
    try {
      const length = Math.ceil(sessionEnd * sampleRate);
      const context = new OfflineAudioContext(2, length, sampleRate);
      const master = context.createGain();
      master.gain.value = masterGain;
      master.connect(context.destination);
      for (const clip of clips) {
        const track = tracks.find((item) => item.id === clip.trackId);
        if (!track || track.muted || (soloActive && !track.solo)) continue;
        const buffer = await decodePath(clip);
        const source = context.createBufferSource();
        source.buffer = buffer;
        const gain = context.createGain();
        const trackGain = context.createGain();
        const pan = context.createStereoPanner();
        const low = context.createBiquadFilter();
        const mid = context.createBiquadFilter();
        const high = context.createBiquadFilter();
        const compressor = context.createDynamicsCompressor();
        const delay = context.createDelay(1);
        const delayWet = context.createGain();
        const convolver = context.createConvolver();
        const reverbWet = context.createGain();
        pan.pan.value = track.pan;
        trackGain.gain.value = track.gain;
        low.type = "lowshelf";
        low.frequency.value = 180;
        low.gain.value = track.effects.enabled ? track.effects.low : 0;
        mid.type = "peaking";
        mid.frequency.value = 1200;
        mid.Q.value = 0.8;
        mid.gain.value = track.effects.enabled ? track.effects.mid : 0;
        high.type = "highshelf";
        high.frequency.value = 6200;
        high.gain.value = track.effects.enabled ? track.effects.high : 0;
        compressor.threshold.value = -12 - track.effects.compressor * 28;
        compressor.ratio.value = track.effects.enabled
          ? 1 + track.effects.compressor * 11
          : 1;
        delay.delayTime.value = 0.28;
        delayWet.gain.value = track.effects.enabled ? track.effects.delay : 0;
        convolver.buffer = makeReverbImpulse(context);
        reverbWet.gain.value = track.effects.enabled ? track.effects.reverb : 0;
        [...track.automation]
          .sort((a, b) => a.time - b.time)
          .forEach((point) => {
            trackGain.gain.linearRampToValueAtTime(point.gain, point.time);
            pan.pan.linearRampToValueAtTime(point.pan, point.time);
          });
        const value = clip.gain;
        gain.gain.setValueAtTime(clip.fadeIn > 0 ? 0 : value, clip.start);
        if (clip.fadeIn > 0)
          gain.gain.linearRampToValueAtTime(value, clip.start + clip.fadeIn);
        if (clip.fadeOut > 0) {
          gain.gain.setValueAtTime(
            value,
            clip.start + clip.duration - clip.fadeOut,
          );
          gain.gain.linearRampToValueAtTime(0, clip.start + clip.duration);
        }
        source.connect(gain).connect(trackGain).connect(low).connect(mid).connect(high).connect(compressor).connect(pan);
        pan.connect(master);
        pan.connect(delay).connect(delayWet).connect(master);
        pan.connect(convolver).connect(reverbWet).connect(master);
        source.start(clip.start, clip.offset, clip.duration);
      }
      const rendered = await context.startRendering();
      const wav = encodeWav(rendered);
      if (window.hinanaEco) {
        const path = await window.hinanaEco.exportAudio(
          wav,
          `${projectName || "Hinana Eco Mix"}.${format}`,
          format,
          bitrate,
        );
        if (path)
          setNotice(`${format.toUpperCase()} 믹스를 내보냈습니다: ${path}`);
        else setNotice("오디오 내보내기를 취소했습니다.");
      } else {
        if (format === "mp3")
          throw new Error("MP3 내보내기는 데스크톱 앱에서 사용할 수 있습니다.");
        const url = URL.createObjectURL(new Blob([wav], { type: "audio/wav" }));
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${projectName}.wav`;
        anchor.click();
        URL.revokeObjectURL(url);
        setNotice("WAV 믹스를 내보냈습니다.");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "내보내기에 실패했습니다.");
    } finally {
      setExporting(false);
    }
  };

  const newProject = () => {
    void window.hinanaEco?.newProject();
    stopSources();
    setPlaying(false);
    setTracks(starterTracks());
    setClips([]);
    buffers.current.clear();
    setProjectName("Untitled Session");
    setProjectPath(null);
    setPlayhead(0);
    setSelectedClipId(null);
    setSelectedClipIds([]);
    localStorage.removeItem("hinana-eco:autosave");
    setNotice("새 세션을 만들었습니다.");
  };

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape" && showExportDialog) {
        setShowExportDialog(false);
        return;
      }
      if (event.key === "Escape" && effectDialog) {
        setEffectDialog(null);
        return;
      }
      if (event.key === "Escape" && panelMenu) {
        setPanelMenu(null);
        return;
      }
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      )
        return;
      if (event.key === "Escape" && showAbout) {
        setShowAbout(false);
      } else if (event.code === "Space" && !showAbout) {
        event.preventDefault();
        togglePlayback();
      } else if (event.key === "Escape" && tool === "cut") {
        setTool("select");
        setNotice("자르기 도구를 취소했습니다.");
      } else if (event.key.toLowerCase() === "s" && !event.ctrlKey && !event.metaKey)
        splitClip();
      else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        event.shiftKey ? rippleDeleteSelected() : deleteCurrentSelection();
      }
      else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
        event.preventDefault();
        copySelected();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") {
        event.preventDefault();
        pasteClips();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateSelected();
      } else if (event.key.toLowerCase() === "l") {
        setLoopEnabled((value) => !value);
      } else if (event.key.toLowerCase() === "r") {
        void startRecording();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  });

  useEffect(() => {
    return window.hinanaEco?.onMenuAction((action) => {
      const actions: Record<string, () => void> = {
        new: newProject,
        open: () => void openProject(),
        import: () => void importFromDesktop(),
        save: () => void saveProject(),
        saveAs: () => void saveProject(true),
        export: () => setShowExportDialog(true),
        undo,
        redo,
        copy: copySelected,
        paste: () => pasteClips(),
        duplicate: duplicateSelected,
        split: splitClip,
        delete: deleteCurrentSelection,
        rippleDelete: rippleDeleteSelected,
        about: () => setShowAbout(true),
      };
      actions[action]?.();
    });
  });

  const moveClip = (
    event: React.PointerEvent<HTMLDivElement>,
    clip: Clip,
  ) => {
    if (tool === "cut") {
      event.preventDefault();
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const origin = event.clientX;
    const movingIds = selectedClipIds.includes(clip.id)
      ? selectedClipIds
      : [clip.id];
    const originals = new Map(
      clips
        .filter((item) => movingIds.includes(item.id))
        .map((item) => [item.id, item.start]),
    );
    const onMove = (move: PointerEvent) => {
      let delta = (move.clientX - origin) / pxPerSecond;
      const anchor = (originals.get(clip.id) || 0) + delta;
      if (snap) delta += Math.round(anchor * 4) / 4 - anchor;
      setClips((items) =>
        items.map((item) =>
          originals.has(item.id)
            ? { ...item, start: Math.max(0, (originals.get(item.id) || 0) + delta) }
            : item,
        ),
      );
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (playing && audioContext.current) {
        const context = audioContext.current;
        const currentTime = clamp(
          playbackStarted.current.timelineTime +
            context.currentTime -
            playbackStarted.current.contextTime,
          0,
          totalDuration,
        );
        setPlayhead(currentTime);
        void schedulePlayback(currentTime);
        setNotice("클립의 새 위치를 현재 재생에 반영했습니다.");
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const trimClip = (
    event: React.PointerEvent<HTMLSpanElement>,
    clip: Clip,
    edge: "start" | "end",
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const origin = event.clientX;
    const original = { ...clip };
    const onMove = (move: PointerEvent) => {
      let delta = (move.clientX - origin) / pxPerSecond;
      if (snap) delta = Math.round(delta * 4) / 4;
      if (edge === "start") {
        delta = clamp(delta, -original.offset, original.duration - 0.05);
        updateClip(clip.id, {
          start: Math.max(0, original.start + delta),
          offset: Math.max(0, original.offset + delta),
          duration: original.duration - delta,
        });
      } else {
        updateClip(clip.id, {
          duration: clamp(
            original.duration + delta,
            0.05,
            original.sourceDuration - original.offset,
          ),
        });
      }
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const timeAtPointer = (clientX: number) => {
    const scroller = timelineScroll.current;
    if (!scroller) return 0;
    const rect = scroller.getBoundingClientRect();
    return clamp(
      (clientX - rect.left + scroller.scrollLeft) / pxPerSecond,
      0,
      totalDuration,
    );
  };

  const dragLoopBoundary = (
    event: React.PointerEvent<HTMLSpanElement>,
    edge: "start" | "end",
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const onMove = (move: PointerEvent) => {
      let next = timeAtPointer(move.clientX);
      if (snap) next = Math.round(next * 4) / 4;
      if (edge === "start")
        setLoopStart(clamp(next, 0, loopEnd - 0.05));
      else setLoopEnd(Math.max(loopStart + 0.05, next));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const useSelectionAsLoop = () => {
    if (!selectionRange) {
      setNotice("Shift를 누른 채 타임라인을 드래그해 범위를 먼저 선택하세요.");
      return;
    }
    const start = Math.min(selectionRange.start, selectionRange.end);
    const end = Math.max(selectionRange.start, selectionRange.end);
    if (end - start < 0.05) {
      setNotice("반복할 범위를 조금 더 넓게 선택하세요.");
      return;
    }
    setLoopStart(start);
    setLoopEnd(end);
    setLoopEnabled(true);
    setNotice(`${timeLabel(start, true)}–${timeLabel(end, true)} 구간을 반복합니다.`);
  };

  const seekToPointer = (clientX: number) => {
    const next = timeAtPointer(clientX);
    setPlayhead(clamp(next, 0, totalDuration));
  };

  const beginScrub = (event: React.PointerEvent<HTMLElement>) => {
    if (
      event.button !== 0 ||
      (event.target instanceof Element &&
        event.target.closest(".audio-clip, .empty-timeline, .drop-hint"))
    )
      return;
    event.preventDefault();
    if (event.shiftKey) {
      const start = timeAtPointer(event.clientX);
      setSelectionRange({ start, end: start });
      const onSelect = (moveEvent: PointerEvent) => {
        const end = timeAtPointer(moveEvent.clientX);
        const left = Math.min(start, end);
        const right = Math.max(start, end);
        const ids = clipsRef.current
          .filter((clip) => clip.start < right && clip.start + clip.duration > left)
          .map((clip) => clip.id);
        setSelectionRange({ start: left, end: right });
        setSelectedClipIds(ids);
        setSelectedClipId(ids[0] || null);
      };
      const finishSelection = () => {
        window.removeEventListener("pointermove", onSelect);
        window.removeEventListener("pointerup", finishSelection);
      };
      window.addEventListener("pointermove", onSelect);
      window.addEventListener("pointerup", finishSelection);
      return;
    }
    setSelectionRange(null);
    if (playing) {
      setPlaying(false);
      stopSources();
    }
    seekToPointer(event.clientX);
    const onMove = (moveEvent: PointerEvent) => seekToPointer(moveEvent.clientX);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const scrollTimelineFromTrack = (event: React.PointerEvent<HTMLDivElement>) => {
    if (
      event.target instanceof Element &&
      event.target.closest(".timeline-scroll-thumb")
    )
      return;
    const scroller = timelineScroll.current;
    const track = timelineScrollbarTrack.current;
    if (!scroller || !track) return;
    const rect = track.getBoundingClientRect();
    const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    scroller.scrollLeft = clamp(
      ratio * timelineScrollbar.content - timelineScrollbar.viewport / 2,
      0,
      Math.max(0, timelineScrollbar.content - timelineScrollbar.viewport),
    );
  };

  const dragTimelineScrollbar = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const scroller = timelineScroll.current;
    const track = timelineScrollbarTrack.current;
    if (!scroller || !track) return;
    const origin = event.clientX;
    const originalScroll = scroller.scrollLeft;
    const thumbWidth = track.clientWidth * (timelineThumbWidth / 100);
    const scale =
      Math.max(0, timelineScrollbar.content - timelineScrollbar.viewport) /
      Math.max(1, track.clientWidth - thumbWidth);
    const onMove = (move: PointerEvent) => {
      scroller.scrollLeft = clamp(
        originalScroll + (move.clientX - origin) * scale,
        0,
        Math.max(0, timelineScrollbar.content - timelineScrollbar.viewport),
      );
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  useEffect(() => {
    if (!trackMenu && !panelMenu) return;
    const close = () => {
      setTrackMenu(null);
      setPanelMenu(null);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("blur", close);
    };
  }, [trackMenu, panelMenu]);

  const rulerTicks = Array.from(
    { length: Math.ceil(totalDuration / (zoom < 0.8 ? 5 : 1)) + 1 },
    (_, index) => index * (zoom < 0.8 ? 5 : 1),
  );
  const timelineThumbWidth = Math.max(
    5,
    Math.min(
      100,
      (timelineScrollbar.viewport / timelineScrollbar.content) * 100,
    ),
  );
  const timelineMaxScroll = Math.max(
    0,
    timelineScrollbar.content - timelineScrollbar.viewport,
  );
  const timelineThumbLeft = timelineMaxScroll
    ? (timelineScrollbar.left / timelineMaxScroll) * (100 - timelineThumbWidth)
    : 0;

  return (
    <div
      className={`app-shell${window.hinanaEco?.platform === "darwin" ? " platform-darwin" : ""}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        void importFiles(event.dataTransfer.files);
      }}
    >
      <input
        ref={fileInput}
        type="file"
        hidden
        multiple
        accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.flac"
        onChange={(event) => {
          if (event.target.files) void importFiles(event.target.files);
          event.target.value = "";
        }}
      />

      <header className="topbar">
        <div
          className="brand"
          role="button"
          tabIndex={0}
          title="HINANA STUDIO ECO 정보"
          onClick={() => setShowAbout(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") setShowAbout(true);
          }}
        >
          <div className="brand-mark"><img src={appIconUrl} alt="" /></div>
          <div>
            <strong>HINANA</strong>
            <span>STUDIO ECO</span>
          </div>
        </div>
        <nav className="project-actions">
          <button onClick={newProject}><Plus size={15} /> 새로 만들기</button>
          <button onClick={() => void openProject()}><FolderOpen size={15} /> 열기</button>
          <button onClick={() => void saveProject()}><Save size={15} /> 저장</button>
          {!!recentProjects.length && (
            <select
              className="recent-select"
              aria-label="최근 프로젝트"
              value=""
              onChange={(event) => void openRecentProject(event.target.value)}
            >
              <option value="" disabled>최근 프로젝트</option>
              {recentProjects.map((path) => (
                <option value={path} key={path}>{path.split(/[\\/]/).pop()}</option>
              ))}
            </select>
          )}
        </nav>
        <div className="project-title">
          <input
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            aria-label="프로젝트 이름"
          />
          <span>{projectPath ? "저장됨" : "로컬 세션"}</span>
        </div>
        <div className="top-actions">
          <button className="icon-button" onClick={() => void backupProject()} title="프로젝트 백업"><SaveAll size={17} /></button>
          <button className="icon-button" onClick={undo} title="실행 취소"><Undo2 size={17} /></button>
          <button className="icon-button" onClick={redo} title="다시 실행"><Redo2 size={17} /></button>
          <button className="import-button" onClick={() => void importFromDesktop()}>
            <Import size={16} /> 오디오 가져오기
          </button>
          <button
            className="export-button"
            onClick={() => setShowExportDialog(true)}
            disabled={exporting}
          >
            <Download size={16} /> {exporting ? "렌더링…" : "내보내기"}
          </button>
        </div>
      </header>

      <main className="workspace">
        <aside className="left-panel">
          <div className="tool-rail">
            <button className={leftTab === "media" ? "active" : ""} onClick={() => setLeftTab("media")}>
              <Music2 size={21} /><span>미디어</span>
            </button>
            <button className={leftTab === "edit" ? "active" : ""} onClick={() => setLeftTab("edit")}>
              <Scissors size={21} /><span>편집</span>
            </button>
            <button className={leftTab === "effects" ? "active" : ""} onClick={() => setLeftTab("effects")}>
              <Sparkles size={21} /><span>효과</span>
            </button>
            <button className="info-button" onClick={() => setShowAbout(true)}>
              <Info size={21} /><span>정보</span>
            </button>
          </div>
          <div className="left-content">
            <div className="panel-heading main-heading">
              <span>{leftTab === "media" ? "내 미디어" : leftTab === "edit" ? "편집 도구" : "오디오 효과"}</span>
              <button
                className="mini-button"
                title={`${leftTab === "media" ? "내 미디어" : leftTab === "edit" ? "편집 도구" : "오디오 효과"} 메뉴`}
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  setPanelMenu({
                    x: rect.right - 190,
                    y: rect.bottom + 4,
                    tab: leftTab,
                  });
                }}
              ><span>•••</span></button>
            </div>
            {leftTab === "media" && (
              <>
                <div className="media-search">⌕ <span>미디어 검색</span></div>
                <button className="media-import" onClick={() => void importFromDesktop()}>
                  <Import size={17} /> 미디어 가져오기
                </button>
                <div className="media-bin">
                  {clips.length ? clips.map((clip) => (
                    <button key={clip.id} onClick={() => { setSelectedClipId(clip.id); setSelectedClipIds([clip.id]); setSelectedTrackId(clip.trackId); }}>
                      <span><Waveform peaks={clip.peaks.slice(0, 80)} color={tracks.find((track) => track.id === clip.trackId)?.color || "#59d9b0"} fadeIn={0} fadeOut={0} /></span>
                      <div><strong>{clip.name}</strong><small>{timeLabel(clip.sourceDuration)} · 오디오</small></div>
                    </button>
                  )) : (
                    <div className="empty-media">
                      <Music2 size={25} />
                      <strong>미디어가 없습니다</strong>
                      <span>오디오 파일을 가져와 시작하세요</span>
                    </div>
                  )}
                </div>
              </>
            )}
            {leftTab === "edit" && (
              <div className="library">
                <button onClick={() => setTool("select")}><Sparkles size={18} /> 선택 및 이동</button>
                <button onClick={toggleCutTool}><Scissors size={18} /> {tool === "cut" ? "자르기 취소" : "클립 자르기"}</button>
                <button onClick={addTrack}><Layers3 size={18} /> 새 오디오 트랙</button>
              </div>
            )}
            {leftTab === "effects" && (
              <div className="library">
                <button onClick={() => openEffectDialog("normalize")}><Gauge size={18} /> Normalize</button>
                <button onClick={() => openEffectDialog("fadeIn")}><AudioLines size={18} /> Fade in</button>
                <button onClick={() => openEffectDialog("fadeOut")}><AudioLines size={18} /> Fade out</button>
              </div>
            )}
            <div className="panel-heading tracks-heading">
              <span>믹서 트랙</span>
              <button className="mini-button" onClick={addTrack}><CirclePlus size={16} /></button>
            </div>
            {!tracks.length && (
              <div className="empty-tracks">
                파일을 가져오면 볼륨과 위치를 따로 조절할 수 있는 트랙이 자동으로 생깁니다.
              </div>
            )}
            <div className="track-list">
              {tracks.map((track, index) => (
                <button
                  className={`track-card ${selectedTrack?.id === track.id ? "active" : ""}`}
                  key={track.id}
                  onClick={() => {
                    setSelectedTrackId(track.id);
                    setSelectedClipId(null);
                    setSelectedClipIds([]);
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setSelectedTrackId(track.id);
                    setSelectedClipId(null);
                    setSelectedClipIds([]);
                    setTrackMenu({ x: event.clientX, y: event.clientY, trackId: track.id });
                  }}
                >
                  <span className="track-number" style={{ color: track.color }}>{String(index + 1).padStart(2, "0")}</span>
                  <span className="track-title"><strong>{track.name}</strong><small>{track.muted ? "음소거" : track.solo ? "솔로" : "Audio Track"}</small></span>
                  <AudioLines size={17} style={{ color: track.color }} />
                </button>
              ))}
            </div>
            <div className="session-info">
              <Disc3 size={18} />
              <div><strong>{sampleRate / 1000} kHz / 32-bit float</strong><span>{clips.length} clips · {tracks.length} tracks</span></div>
            </div>
          </div>
        </aside>

        <section className={`center-stage${loopEnabled ? " loop-active" : ""}`}>
          <div className="transport">
            <div className="transport-left">
              <button className={tool === "select" ? "active" : ""} onClick={() => setTool("select")} title="선택 도구">
                <Sparkles size={17} />
              </button>
              <button
                className={tool === "cut" ? "active" : ""}
                onClick={toggleCutTool}
                title={tool === "cut" ? "자르기 취소 (Esc)" : "자르기 도구"}
              >
                <Scissors size={17} />
              </button>
              <span className="divider" />
              <button className={snap ? "active" : ""} onClick={() => setSnap((value) => !value)} title="스냅">
                <Magnet size={17} />
              </button>
              <button onClick={copySelected} title="복사 (Cmd/Ctrl+C)"><Copy size={16} /></button>
              <button onClick={() => pasteClips()} title="붙여넣기 (Cmd/Ctrl+V)"><ClipboardPaste size={16} /></button>
            </div>
            <div className="transport-center">
              <button onClick={() => setPlayhead(Math.max(0, playhead - 5))}><Rewind size={17} /></button>
              <button onClick={() => setPlayhead(0)}><Square size={13} /></button>
              <button className="play-button" onClick={togglePlayback}>
                {playing ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}
              </button>
              <button
                className={recording ? "record-button recording" : "record-button"}
                onClick={() => void startRecording()}
                title="마이크 녹음 (R)"
              ><Mic size={17} /></button>
              <button onClick={() => setPlayhead(Math.min(totalDuration, playhead + 5))}><FastForward size={17} /></button>
              <div className="time-display">
                <strong>{timeLabel(playhead, true)}</strong>
                <span>{Math.floor((playhead * bpm) / 60) + 1} · {Math.floor(((playhead * bpm) / 60 % 1) * 4) + 1}</span>
              </div>
            </div>
            <div className="transport-right">
              <button className={metronome ? "active" : ""} onClick={() => setMetronome((value) => !value)} title="메트로놈">M</button>
              <button className={loopEnabled ? "active" : ""} onClick={() => setLoopEnabled((value) => !value)} title="구간 반복 (L)"><Repeat2 size={17} /></button>
              <select value={playbackRate} onChange={(event) => setPlaybackRate(Number(event.target.value))} title="재생 속도">
                <option value=".5">0.5×</option>
                <option value=".75">0.75×</option>
                <option value="1">1×</option>
                <option value="1.25">1.25×</option>
                <option value="1.5">1.5×</option>
                <option value="2">2×</option>
              </select>
              <label>{bpm}<span>BPM</span><input type="number" value={bpm} onChange={(e) => setBpm(clamp(Number(e.target.value), 20, 300))} /></label>
              <span className="divider" />
              <button onClick={() => setZoom((value) => clamp(value - 0.2, 0.35, 3))}><ZoomOut size={17} /></button>
              <span className="zoom-label">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((value) => clamp(value + 0.2, 0.35, 3))}><ZoomIn size={17} /></button>
            </div>
          </div>
          {loopEnabled && (
            <div className="loop-controls-strip">
              <Repeat2 size={15} />
              <strong>구간 반복</strong>
              <label>
                시작
                <input
                  type="number"
                  min="0"
                  max={loopEnd - 0.05}
                  step=".05"
                  value={Number(loopStart.toFixed(2))}
                  onChange={(event) =>
                    setLoopStart(clamp(Number(event.target.value), 0, loopEnd - 0.05))
                  }
                />
              </label>
              <button onClick={() => setLoopStart(clamp(playhead, 0, loopEnd - 0.05))}>
                재생 위치 → 시작
              </button>
              <label>
                끝
                <input
                  type="number"
                  min={loopStart + 0.05}
                  step=".05"
                  value={Number(loopEnd.toFixed(2))}
                  onChange={(event) =>
                    setLoopEnd(Math.max(loopStart + 0.05, Number(event.target.value)))
                  }
                />
              </label>
              <button onClick={() => setLoopEnd(Math.max(loopStart + 0.05, playhead))}>
                재생 위치 → 끝
              </button>
              <button
                disabled={!selectionRange}
                onClick={useSelectionAsLoop}
                title="Shift를 누른 채 타임라인을 드래그해 선택한 범위를 사용합니다."
              >
                선택 범위 사용
              </button>
              <span>{(loopEnd - loopStart).toFixed(2)}초</span>
            </div>
          )}

          <div className="timeline-shell">
            <div className="timeline-label-spacer"><span>TRACK</span><span>OUTPUT</span></div>
            <div
              className={`timeline-scroll ${tool === "cut" ? "cut-mode" : ""}`}
              ref={timelineScroll}
              onPointerDown={beginScrub}
            >
              <div className="timeline-content" style={{ width: totalDuration * pxPerSecond }}>
                <div className="ruler">
                  {rulerTicks.map((tick) => (
                    <span key={tick} style={{ left: tick * pxPerSecond }}>
                      <i />{timeLabel(tick)}
                    </span>
                  ))}
                </div>
                {loopEnabled && (
                  <div
                    className="loop-region"
                    style={{
                      left: loopStart * pxPerSecond,
                      width: Math.max(4, (loopEnd - loopStart) * pxPerSecond),
                    }}
                  >
                    <span
                      className="loop-handle start"
                      onPointerDown={(event) => dragLoopBoundary(event, "start")}
                    ><i>IN</i></span>
                    <span
                      className="loop-handle end"
                      onPointerDown={(event) => dragLoopBoundary(event, "end")}
                    ><i>OUT</i></span>
                  </div>
                )}
                {selectionRange && (
                  <div
                    className="selection-range"
                    style={{
                      left: Math.min(selectionRange.start, selectionRange.end) * pxPerSecond,
                      width:
                        Math.abs(selectionRange.end - selectionRange.start) *
                        pxPerSecond,
                    }}
                  />
                )}
                <div
                  className="playhead"
                  style={{ left: playhead * pxPerSecond }}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    beginScrub(event);
                  }}
                ><i /></div>
                {tracks.map((track, trackIndex) => (
                  <div className="timeline-row" key={track.id}>
                    {track.automation.map((point) => (
                      <span
                        className="automation-marker"
                        key={`${point.time}-${point.gain}-${point.pan}`}
                        style={{ left: point.time * pxPerSecond }}
                        title={`${timeLabel(point.time, true)} · ${dbLabel(point.gain)} · Pan ${point.pan.toFixed(2)}`}
                      />
                    ))}
                    {clips.filter((clip) => clip.trackId === track.id).map((clip) => (
                      <div
                        key={clip.id}
                        className={`audio-clip ${
                          selectedClipId === clip.id || selectedClipIds.includes(clip.id)
                            ? "selected"
                            : ""
                        }`}
                        style={{
                          left: clip.start * pxPerSecond,
                          width: Math.max(24, clip.duration * pxPerSecond),
                          "--clip-color": track.color,
                        } as React.CSSProperties}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (tool === "cut") {
                            const rect = event.currentTarget.getBoundingClientRect();
                            const splitTime =
                              clip.start +
                              ((event.clientX - rect.left) / rect.width) *
                                clip.duration;
                            setPlayhead(splitTime);
                            setSelectedClipId(clip.id);
                            setSelectedTrackId(track.id);
                            splitAt(clip, splitTime);
                            setTool("select");
                            return;
                          }
                          if (event.metaKey || event.ctrlKey || event.shiftKey) {
                            setSelectedClipIds((ids) =>
                              ids.includes(clip.id)
                                ? ids.filter((id) => id !== clip.id)
                                : [...ids, clip.id],
                            );
                          } else {
                            setSelectedClipIds([clip.id]);
                          }
                          setSelectedClipId(clip.id);
                          setSelectedTrackId(track.id);
                        }}
                        onDoubleClick={() => {
                          if (tool === "select") setPlayhead(clip.start);
                        }}
                        onPointerDown={(event) => moveClip(event, clip)}
                      >
                        <span className="trim-handle start" onPointerDown={(event) => trimClip(event, clip, "start")} />
                        <div className="clip-title"><Music2 size={12} /><span>{clip.name}</span><small>{timeLabel(clip.duration)}</small></div>
                        <Waveform peaks={clip.peaks} color={track.color} fadeIn={clip.fadeIn} fadeOut={clip.fadeOut} />
                        <span className="trim-handle end" onPointerDown={(event) => trimClip(event, clip, "end")} />
                      </div>
                    ))}
                    {!clips.some((clip) => clip.trackId === track.id) && trackIndex === 0 && (
                      <button className="drop-hint" onClick={() => void importFromDesktop()}>
                        <Import size={18} /> 여기에 오디오를 드롭하세요
                      </button>
                    )}
                  </div>
                ))}
                {!tracks.length && (
                  <button className="empty-timeline" onClick={() => void importFromDesktop()}>
                    <span><Import size={24} /></span>
                    <strong>오디오 파일을 가져오세요</strong>
                    <small>가져온 파일은 중앙에 파형으로 바로 배치됩니다.</small>
                  </button>
                )}
              </div>
            </div>
            <div
              className="timeline-horizontal-scrollbar"
              ref={timelineScrollbarTrack}
              onPointerDown={scrollTimelineFromTrack}
            >
              <div
                className="timeline-scroll-thumb"
                style={{
                  left: `${timelineThumbLeft}%`,
                  width: `${timelineThumbWidth}%`,
                }}
                onPointerDown={dragTimelineScrollbar}
              />
            </div>
            <div className="track-controls">
              <div className="track-controls-header">
                <span>GAIN</span><span>PAN</span><span>MUTE</span><span>SOLO</span>
              </div>
              {tracks.map((track) => (
                <div
                  className={`track-control-row ${selectedTrackId === track.id && !selectedClipId ? "selected" : ""}`}
                  key={track.id}
                  onClick={() => {
                    setSelectedTrackId(track.id);
                    setSelectedClipId(null);
                    setSelectedClipIds([]);
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setSelectedTrackId(track.id);
                    setSelectedClipId(null);
                    setSelectedClipIds([]);
                    setTrackMenu({ x: event.clientX, y: event.clientY, trackId: track.id });
                  }}
                >
                  <div className="track-identity">
                    <span style={{ background: track.color }} />
                    <input value={track.name} onChange={(e) => updateTrack(track.id, { name: e.target.value })} />
                  </div>
                  <Knob value={track.gain} min={0} max={1.5} label="트랙 게인" onChange={(gain) => updateTrack(track.id, { gain })} />
                  <Knob value={track.pan} min={-1} max={1} label="트랙 팬" onChange={(pan) => updateTrack(track.id, { pan })} />
                  <button
                    className={track.muted ? "toggle-on mute" : ""}
                    title="Mute · 이 트랙 음소거"
                    aria-label={`${track.name} 음소거`}
                    onClick={() => updateTrack(track.id, { muted: !track.muted })}
                  >M</button>
                  <button
                    className={track.solo ? "toggle-on solo" : ""}
                    title="Solo · 이 트랙만 듣기"
                    aria-label={`${track.name} 솔로`}
                    onClick={() => updateTrack(track.id, { solo: !track.solo })}
                  >S</button>
                </div>
              ))}
            </div>
            <div className="timeline-scroll-corner" />
          </div>
        </section>

        <aside className="right-panel">
          <div className="inspector-heading">
            <div><SlidersHorizontal size={17} /><span>인스펙터</span></div>
            {selectedClip && <button onClick={() => { setSelectedClipId(null); setSelectedClipIds([]); }}><X size={16} /></button>}
          </div>
          {selectedClip && selectedTrack ? (
            <div className="inspector-content">
              <div className="selected-name">
                <span style={{ background: selectedTrack.color }}><Music2 size={18} /></span>
                <div><strong>{selectedClip.name}</strong><small>{selectedTrack.name} · {timeLabel(selectedClip.duration)}</small></div>
              </div>
              <section className="property-section">
                <h3>클립</h3>
                <label><span>시작</span><input type="number" step=".01" value={selectedClip.start.toFixed(2)} onChange={(e) => updateClip(selectedClip.id, { start: Math.max(0, Number(e.target.value)) })} /><em>sec</em></label>
                <label><span>길이</span><input type="number" step=".01" value={selectedClip.duration.toFixed(2)} onChange={(e) => updateClip(selectedClip.id, { duration: clamp(Number(e.target.value), 0.05, selectedClip.sourceDuration - selectedClip.offset) })} /><em>sec</em></label>
                <label><span>소스 오프셋</span><input type="number" step=".01" value={selectedClip.offset.toFixed(2)} onChange={(e) => updateClip(selectedClip.id, { offset: clamp(Number(e.target.value), 0, selectedClip.sourceDuration - 0.05) })} /><em>sec</em></label>
                <button className="wide-tool" onClick={splitClip}><Scissors size={15} /> 재생 헤드에서 분할</button>
              </section>
              <section className="property-section">
                <h3>볼륨</h3>
                <div className="range-row">
                  <Volume2 size={16} />
                  <input type="range" min="0" max={Math.max(4, Math.ceil(selectedClip.gain))} step=".01" value={selectedClip.gain} onChange={(e) => updateClip(selectedClip.id, { gain: Number(e.target.value) })} />
                  <strong>{dbLabel(selectedClip.gain)}</strong>
                </div>
                <label><span>페이드 인</span><input type="number" min="0" max={selectedClip.duration} step=".05" value={selectedClip.fadeIn} onChange={(e) => updateClip(selectedClip.id, { fadeIn: clamp(Number(e.target.value), 0, selectedClip.duration) })} /><em>sec</em></label>
                <label><span>페이드 아웃</span><input type="number" min="0" max={selectedClip.duration} step=".05" value={selectedClip.fadeOut} onChange={(e) => updateClip(selectedClip.id, { fadeOut: clamp(Number(e.target.value), 0, selectedClip.duration) })} /><em>sec</em></label>
              </section>
              <section className="property-section">
                <h3>빠른 처리</h3>
                <div className="quick-grid">
                  <button onClick={() => openEffectDialog("fadeIn")}>Fade in</button>
                  <button onClick={() => openEffectDialog("fadeOut")}>Fade out</button>
                  <button onClick={() => openEffectDialog("normalize")}><Gauge size={14} /> Normalize</button>
                  <button onClick={() => updateClip(selectedClip.id, { gain: 0 })}><VolumeX size={14} /> Silence</button>
                  <button onClick={duplicateSelected}><Copy size={14} /> 복제</button>
                  <button onClick={() => void relinkSelectedClip()}><Link2 size={14} /> 재연결</button>
                  <button onClick={rippleDeleteSelected}><Trash2 size={14} /> 리플 삭제</button>
                </div>
              </section>
              <button className="delete-button" onClick={deleteSelected}><Trash2 size={15} /> 선택한 클립 삭제</button>
            </div>
          ) : selectedTrack ? (
            <div className="inspector-content">
              <div className="selected-name">
                <span style={{ background: selectedTrack.color }}><AudioLines size={18} /></span>
                <div><strong>{selectedTrack.name}</strong><small>트랙 효과 · 자동화 {selectedTrack.automation.length}개</small></div>
              </div>
              <section className="property-section">
                <h3>효과 체인</h3>
                <button
                  className="wide-tool"
                  onClick={() => updateTrackEffect(selectedTrack.id, "enabled", !selectedTrack.effects.enabled)}
                >
                  {selectedTrack.effects.enabled ? "효과 체인 켜짐" : "효과 체인 꺼짐"}
                </button>
                {([
                  ["low", "저음 EQ", -12, 12],
                  ["mid", "중음 EQ", -12, 12],
                  ["high", "고음 EQ", -12, 12],
                  ["compressor", "컴프레서", 0, 1],
                  ["delay", "딜레이", 0, 0.65],
                  ["reverb", "리버브", 0, 0.65],
                ] as const).map(([key, label, min, max]) => (
                  <label key={key}>
                    <span>{label}</span>
                    <input
                      type="range"
                      min={min}
                      max={max}
                      step=".01"
                      value={selectedTrack.effects[key]}
                      onChange={(event) =>
                        updateTrackEffect(selectedTrack.id, key, Number(event.target.value))
                      }
                    />
                    <em>{key === "low" || key === "mid" || key === "high" ? "dB" : Math.round(selectedTrack.effects[key] * 100)}</em>
                  </label>
                ))}
              </section>
              <section className="property-section">
                <h3>자동화</h3>
                <button className="wide-tool" onClick={() => addAutomationPoint(selectedTrack)}>
                  <CirclePlus size={15} /> 현재 재생 헤드에 볼륨·팬 지점 추가
                </button>
                {!!selectedTrack.automation.length && (
                  <button
                    className="wide-tool"
                    onClick={() => updateTrack(selectedTrack.id, { automation: [] })}
                  >
                    <Trash2 size={15} /> 자동화 모두 지우기
                  </button>
                )}
              </section>
            </div>
          ) : (
            <div className="empty-inspector">
              <div><SlidersHorizontal size={27} /></div>
              <strong>클립을 선택하세요</strong>
              <p>볼륨, 길이, 페이드와 세부 속성을 여기에서 조정할 수 있습니다.</p>
            </div>
          )}
          <div className="master-section">
            <div className="master-title"><span>MASTER</span><small>{sampleRate / 1000} kHz <ChevronDown size={12} /></small></div>
            <div className="master-body">
              <div className="meter">
                {Array.from({ length: 16 }, (_, index) => (
                  <i key={index} className={index / 16 < masterLevel ? "lit" : ""} />
                ))}
              </div>
              <div className="master-fader">
                <input
                  type="range"
                  min="0"
                  max="1.2"
                  step=".01"
                  value={masterGain}
                  title="전체 출력 볼륨"
                  aria-label="마스터 출력 볼륨"
                  onChange={(e) => setMasterGain(Number(e.target.value))}
                />
                <strong>{dbLabel(masterGain)}</strong>
              </div>
              <Headphones size={18} />
            </div>
          </div>
        </aside>
      </main>

      <footer className="statusbar">
        <span className="status-dot" />
        <span>{notice}</span>
        <div>
          <span>{sampleRate.toLocaleString()} Hz</span>
          <span>Buffer 512</span>
          <span>CPU {playing ? "8" : "2"}%</span>
        </div>
      </footer>
      {showExportDialog && (
        <div
          className="export-overlay"
          onPointerDown={() => setShowExportDialog(false)}
        >
          <div
            className="audio-export-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-title"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="export-dialog-header">
              <div>
                <Download size={19} />
                <span>
                  <h2 id="export-title">오디오 내보내기</h2>
                  <small>{projectName}</small>
                </span>
              </div>
              <button
                aria-label="내보내기 창 닫기"
                onClick={() => setShowExportDialog(false)}
              >
                <X size={17} />
              </button>
            </div>
            <div className="export-dialog-body">
              <h3>파일 형식</h3>
              <div className="format-options">
                <button
                  className={exportFormat === "wav" ? "selected" : ""}
                  onClick={() => setExportFormat("wav")}
                >
                  <strong>WAV</strong>
                  <span>무손실 PCM</span>
                  <small>편집·보관용</small>
                </button>
                <button
                  className={exportFormat === "mp3" ? "selected" : ""}
                  onClick={() => setExportFormat("mp3")}
                >
                  <strong>MP3</strong>
                  <span>압축 오디오</span>
                  <small>공유·감상용</small>
                </button>
              </div>
              {exportFormat === "mp3" && (
                <label className="bitrate-setting">
                  <span>
                    <strong>MP3 음질</strong>
                    <small>높을수록 음질과 파일 크기가 증가합니다.</small>
                  </span>
                  <select
                    value={mp3Bitrate}
                    onChange={(event) => setMp3Bitrate(Number(event.target.value))}
                  >
                    <option value="128">128 kbps</option>
                    <option value="192">192 kbps</option>
                    <option value="256">256 kbps</option>
                    <option value="320">320 kbps</option>
                  </select>
                </label>
              )}
              <div className="export-summary">
                <span>스테레오 · {sampleRate / 1000} kHz · {timeLabel(sessionEnd)}</span>
                <strong>
                  예상 크기 약{" "}
                  {exportFormat === "mp3"
                    ? Math.max(0.1, (sessionEnd * mp3Bitrate) / 8 / 1024).toFixed(1)
                    : Math.max(
                        0.1,
                        (sessionEnd * sampleRate * 2 * 2) / 1024 / 1024,
                      ).toFixed(1)}{" "}
                  MB
                </strong>
              </div>
            </div>
            <div className="export-dialog-actions">
              <button onClick={() => setShowExportDialog(false)}>취소</button>
              <button
                className="primary"
                disabled={!clips.length}
                onClick={() => void exportMix(exportFormat, mp3Bitrate)}
              >
                <Download size={15} />
                {exportFormat.toUpperCase()}로 내보내기
              </button>
            </div>
          </div>
        </div>
      )}
      {panelMenu && (
        <div
          className="panel-action-menu"
          style={{ left: panelMenu.x, top: panelMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {panelMenu.tab === "media" && (
            <>
              <button onClick={() => { setPanelMenu(null); void importFromDesktop(); }}>
                <Import size={14} /> 오디오 가져오기
              </button>
              <button onClick={() => { setPanelMenu(null); addTrack(); }}>
                <Layers3 size={14} /> 빈 오디오 트랙 추가
              </button>
            </>
          )}
          {panelMenu.tab === "edit" && (
            <>
              <button onClick={() => { setTool("select"); setPanelMenu(null); }}>
                <Sparkles size={14} /> 선택 도구
              </button>
              <button onClick={() => { toggleCutTool(); setPanelMenu(null); }}>
                <Scissors size={14} /> {tool === "cut" ? "자르기 취소" : "자르기 도구"}
              </button>
              <span className="menu-separator" />
              <button onClick={() => { undo(); setPanelMenu(null); }}>
                <Undo2 size={14} /> 실행 취소
              </button>
              <button onClick={() => { redo(); setPanelMenu(null); }}>
                <Redo2 size={14} /> 다시 실행
              </button>
            </>
          )}
          {panelMenu.tab === "effects" && (
            <>
              <button className={!selectedClip ? "disabled" : ""} onClick={() => openEffectDialog("normalize")}>
                <Gauge size={14} /> 노멀라이즈 설정
              </button>
              <button className={!selectedClip ? "disabled" : ""} onClick={() => openEffectDialog("fadeIn")}>
                <AudioLines size={14} /> 페이드 인 설정
              </button>
              <button className={!selectedClip ? "disabled" : ""} onClick={() => openEffectDialog("fadeOut")}>
                <AudioLines size={14} /> 페이드 아웃 설정
              </button>
            </>
          )}
        </div>
      )}
      {effectDialog && selectedClip && (
        <div
          className="effect-overlay"
          onPointerDown={() => setEffectDialog(null)}
        >
          <div
            className="effect-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="effect-title"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="effect-dialog-header">
              <span>
                {effectDialog.type === "normalize" ? <Gauge size={19} /> : <AudioLines size={19} />}
              </span>
              <div>
                <h2 id="effect-title">
                  {effectDialog.type === "normalize"
                    ? "노멀라이즈"
                    : effectDialog.type === "fadeIn"
                      ? "페이드 인"
                      : "페이드 아웃"}
                </h2>
                <small>{selectedClip.name}</small>
              </div>
              <button aria-label="효과 설정 닫기" onClick={() => setEffectDialog(null)}>
                <X size={17} />
              </button>
            </div>

            {effectDialog.type === "normalize" ? (
              <div className="effect-settings">
                <p>클립의 가장 큰 피크가 지정한 레벨에 도달하도록 게인을 계산합니다.</p>
                <label>
                  <span>목표 피크</span>
                  <div>
                    <input
                      type="number"
                      min="-24"
                      max="0"
                      step=".1"
                      value={effectDialog.targetDb}
                      onChange={(event) =>
                        setEffectDialog({
                          type: "normalize",
                          targetDb: clamp(Number(event.target.value), -24, 0),
                        })
                      }
                    />
                    <em>dBFS</em>
                  </div>
                </label>
                <input
                  className="effect-range"
                  type="range"
                  min="-24"
                  max="0"
                  step=".1"
                  value={effectDialog.targetDb}
                  onChange={(event) =>
                    setEffectDialog({
                      type: "normalize",
                      targetDb: Number(event.target.value),
                    })
                  }
                />
                <div className="effect-readout">
                  <span>현재 출력 피크</span>
                  <strong>{Number.isFinite(selectedPeakDb) ? `${selectedPeakDb.toFixed(1)} dBFS` : "무음"}</strong>
                </div>
              </div>
            ) : (
              <div className="effect-settings">
                <p>
                  {effectDialog.type === "fadeIn"
                    ? "클립 시작 부분의 소리를 0에서 현재 볼륨까지 서서히 올립니다."
                    : "클립 끝 부분의 소리를 현재 볼륨에서 0까지 서서히 줄입니다."}
                </p>
                <label>
                  <span>적용 시간</span>
                  <div>
                    <input
                      type="number"
                      min="0"
                      max={selectedClip.duration}
                      step=".05"
                      value={effectDialog.duration}
                      onChange={(event) =>
                        setEffectDialog({
                          type: effectDialog.type,
                          duration: clamp(
                            Number(event.target.value),
                            0,
                            selectedClip.duration,
                          ),
                        })
                      }
                    />
                    <em>초</em>
                  </div>
                </label>
                <input
                  className="effect-range"
                  type="range"
                  min="0"
                  max={selectedClip.duration}
                  step=".05"
                  value={effectDialog.duration}
                  onChange={(event) =>
                    setEffectDialog({
                      type: effectDialog.type,
                      duration: Number(event.target.value),
                    })
                  }
                />
                <div className="effect-readout">
                  <span>클립 전체 길이</span>
                  <strong>{selectedClip.duration.toFixed(2)}초</strong>
                </div>
              </div>
            )}

            <div className="effect-dialog-actions">
              <button onClick={() => setEffectDialog(null)}>취소</button>
              <button className="primary" onClick={applyEffect}>적용</button>
            </div>
          </div>
        </div>
      )}
      {showAbout && (
        <div className="about-overlay" onPointerDown={() => setShowAbout(false)}>
          <div
            className="about-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-title"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button
              className="about-close"
              aria-label="정보창 닫기"
              onClick={() => setShowAbout(false)}
            >
              <X size={18} />
            </button>
            <div className="about-logo">
              <img src={appIconUrl} alt="" />
            </div>
            <h2 id="about-title">HINANA STUDIO ECO</h2>
            <p>소리를 자유롭게 다듬고 믹싱하는 데스크톱 오디오 스튜디오</p>
            <div className="about-badges">
              <span>멀티트랙</span>
              <span>비파괴 편집</span>
              <span>WAV 믹스</span>
            </div>
            <dl>
              <div>
                <dt>프로그램</dt>
                <dd>HINANA STUDIO ECO</dd>
              </div>
              <div>
                <dt>버전</dt>
                <dd>Ver. {packageInfo.version}</dd>
              </div>
              <div>
                <dt>오디오 엔진</dt>
                <dd>Web Audio · {sampleRate / 1000} kHz</dd>
              </div>
              <div>
                <dt>개발·제작</dt>
                <dd>
                  비나래
                  <button
                    className="about-github"
                    onClick={() =>
                      void window.hinanaEco?.openExternal(
                        "https://github.com/murikubo",
                      )
                    }
                  >
                    GitHub
                  </button>
                </dd>
              </div>
            </dl>
            <small className="about-copyright">
              Copyright © 2026 비나래. All rights reserved.
            </small>
          </div>
        </div>
      )}
      {trackMenu && (
        <div
          className="track-context-menu"
          style={{ left: trackMenu.x, top: trackMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button onClick={() => deleteTrack(trackMenu.trackId)}>
            <Trash2 size={14} /> 트랙 삭제
            <kbd>Delete</kbd>
          </button>
        </div>
      )}
    </div>
  );
}
