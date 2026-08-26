import { useVideoPlayer } from '@/lib/video';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUpRight,
  BarChart3,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Droplets,
  Gauge,
  Medal,
  Sparkles,
  Waves,
} from 'lucide-react';

const SCENE_DURATIONS = {
  hook: 3000,
  records: 3500,
  athletes: 3500,
  rankings: 3900,
  close: 3000,
};

export default function VideoTemplate() {
  const { currentScene } = useVideoPlayer({
    durations: SCENE_DURATIONS,
    loop: false,
  });

  return (
    <div className="video-stage">
      <div className="video-frame">
        <Atmosphere />
        <BrandMark />
        <AnimatePresence mode="wait" initial={false}>
          {currentScene === 0 && <HookScene key="hook" />}
          {currentScene === 1 && <RecordsScene key="records" />}
          {currentScene === 2 && <AthletesScene key="athletes" />}
          {currentScene === 3 && <RankingsScene key="rankings" />}
          {currentScene === 4 && <CloseScene key="close" />}
        </AnimatePresence>
        <ProgressBar scene={currentScene} />
      </div>
    </div>
  );
}

function Atmosphere() {
  return (
    <>
      <div className="aurora aurora-one" />
      <div className="aurora aurora-two" />
      <div className="grid-glow" />
      <div className="grain" />
    </>
  );
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand-mark ${compact ? 'brand-mark-compact' : ''}`}>
      <span className="brand-symbol">
        <Waves size={compact ? 13 : 16} strokeWidth={2.4} />
      </span>
      <span>SWIMTRACK</span>
    </div>
  );
}

function SceneShell({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.section
      className={`scene ${className}`}
      initial={{ opacity: 0, y: 20, filter: 'blur(12px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -20, filter: 'blur(12px)' }}
      transition={{ duration: 0.72, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.section>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="eyebrow">{children}</div>;
}

function SceneHeading({
  eyebrow,
  children,
  detail,
}: {
  eyebrow: string;
  children: React.ReactNode;
  detail?: string;
}) {
  return (
    <div className="scene-heading">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1>{children}</h1>
      {detail && <p>{detail}</p>}
    </div>
  );
}

function HookScene() {
  return (
    <SceneShell className="hook-scene">
      <div className="hook-orbit orbit-a" />
      <div className="hook-orbit orbit-b" />
      <motion.div
        className="hook-emblem"
        initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.9, type: 'spring', stiffness: 160 }}
      >
        <Droplets size={33} strokeWidth={1.5} />
      </motion.div>
      <motion.div
        className="hook-copy"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.38, duration: 0.8 }}
      >
        <span className="hook-kicker">FOR EVERY SPLIT SECOND</span>
        <h1>
          泳ぎの成長を、
          <br />
          <span>ひとつに。</span>
        </h1>
        <p>記録とランキングを、チームの力へ。</p>
      </motion.div>
      <motion.div
        className="hook-tag"
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.75, duration: 0.6 }}
      >
        SWIMTRACK <ArrowUpRight size={14} />
      </motion.div>
    </SceneShell>
  );
}

function AppWindow({
  children,
  title,
  section,
  className = '',
}: {
  children: React.ReactNode;
  title: string;
  section: string;
  className?: string;
}) {
  return (
    <motion.div
      className={`app-window ${className}`}
      initial={{ y: 45, rotateX: 9, opacity: 0 }}
      animate={{ y: 0, rotateX: 0, opacity: 1 }}
      transition={{ delay: 0.16, duration: 0.9, type: 'spring', stiffness: 90, damping: 17 }}
    >
      <div className="app-window-top">
        <div className="window-dots"><i /><i /><i /></div>
        <span className="window-title">{title}</span>
        <span className="window-section">{section}</span>
      </div>
      <div className="app-window-body">{children}</div>
    </motion.div>
  );
}

function RecordsScene() {
  return (
    <SceneShell className="product-scene">
      <SceneHeading eyebrow="01 / RECORDS" detail="泳ぎの変化を、ひと目で追える。">
        記録を、
        <br />
        <span>見える化。</span>
      </SceneHeading>
      <AppWindow title="SWIMTRACK" section="DASHBOARD">
        <div className="dashboard-head">
          <div>
            <span className="micro-label">TEAM OVERVIEW</span>
            <h3>今日のスイムログ</h3>
          </div>
          <div className="date-chip">2026.08 <ChevronRight size={12} /></div>
        </div>
        <div className="stat-grid">
          <StatCard icon={<Clock3 size={15} />} label="BEST RECORD" value="00:42.8" tone="blue" />
          <StatCard icon={<Gauge size={15} />} label="IMPROVEMENT" value="+08.4%" tone="aqua" />
        </div>
        <div className="chart-card">
          <div className="chart-caption"><span>MONTHLY PROGRESS</span><b>LAST 6 MONTHS</b></div>
          <div className="spark-chart">
            <svg viewBox="0 0 300 78" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="#4ee9ff" stopOpacity=".32" />
                  <stop offset="1" stopColor="#4ee9ff" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0 63 C26 60, 35 52, 57 56 S82 44, 103 47 S128 30, 149 37 S177 27, 195 31 S220 17, 239 22 S269 8, 300 12 V78 H0Z" fill="url(#chartFill)" />
              <path d="M0 63 C26 60, 35 52, 57 56 S82 44, 103 47 S128 30, 149 37 S177 27, 195 31 S220 17, 239 22 S269 8, 300 12" fill="none" stroke="#58e9ff" strokeWidth="3" strokeLinecap="round" />
              <circle cx="239" cy="22" r="4" fill="#fff" stroke="#58e9ff" strokeWidth="3" />
            </svg>
          </div>
          <div className="chart-months"><span>MAR</span><span>APR</span><span>MAY</span><span>JUN</span><span>JUL</span><span>AUG</span></div>
        </div>
      </AppWindow>
    </SceneShell>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'blue' | 'aqua';
}) {
  return (
    <div className={`stat-card stat-${tone}`}>
      <span className="stat-icon">{icon}</span>
      <span className="stat-label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AthletesScene() {
  const rows = [
    ['ATHLETE 01', 'IM / 15M', '00:42.8', 'BEST'],
    ['ATHLETE 02', 'IM / 15M', '00:44.1', 'NEW'],
    ['ATHLETE 03', 'IM / 15M', '00:46.7', 'BEST'],
  ];
  return (
    <SceneShell className="product-scene">
      <SceneHeading eyebrow="02 / ATHLETES" detail="一人ひとりの挑戦に、確かな記録を。">
        選手ごとの
        <br />
        <span>ベストを管理。</span>
      </SceneHeading>
      <AppWindow title="SWIMTRACK" section="ATHLETES" className="athlete-window">
        <div className="athlete-toolbar">
          <div className="toolbar-title"><CircleUserRound size={16} /><span>ATHLETE LIST</span></div>
          <span className="filter-chip">ALL <ChevronRight size={11} /></span>
        </div>
        <div className="athlete-list">
          {rows.map(([name, event, time, badge], index) => (
            <motion.div
              className="athlete-row"
              key={name}
              initial={{ opacity: 0, x: 25 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.42 + index * 0.12, duration: 0.45 }}
            >
              <div className="athlete-avatar">{String(index + 1).padStart(2, '0')}</div>
              <div className="athlete-info"><strong>{name}</strong><span>{event}</span></div>
              <div className="athlete-time"><strong>{time}</strong><span className={badge === 'NEW' ? 'mint' : ''}>{badge}</span></div>
              <ChevronRight size={14} className="row-arrow" />
            </motion.div>
          ))}
        </div>
        <div className="window-footnote"><Sparkles size={13} /> Personal bests update automatically</div>
      </AppWindow>
    </SceneShell>
  );
}

function RankingsScene() {
  return (
    <SceneShell className="product-scene">
      <SceneHeading eyebrow="03 / RANKINGS" detail="今の立ち位置がわかるから、次の一歩が見える。">
        今の自分を知って、
        <br />
        <span>次につなげる。</span>
      </SceneHeading>
      <AppWindow title="SWIMTRACK" section="IM RANKINGS" className="rank-window">
        <div className="rank-heading"><div><span className="micro-label">MONTHLY RANKING</span><h3>IM / 15M</h3></div><span className="period-chip">AUG 2026</span></div>
        <div className="podium">
          <div className="podium-item second"><span className="rank-number">02</span><div className="podium-bar"><strong>00:44.1</strong><span>ATHLETE 02</span></div></div>
          <div className="podium-item first"><Medal size={16} /><span className="rank-number">01</span><div className="podium-bar"><strong>00:42.8</strong><span>ATHLETE 01</span></div></div>
          <div className="podium-item third"><span className="rank-number">03</span><div className="podium-bar"><strong>00:46.7</strong><span>ATHLETE 03</span></div></div>
        </div>
        <div className="ranking-summary"><BarChart3 size={15} /><span>BEST TIME</span><b>+8.4%</b><em>vs. previous month</em></div>
      </AppWindow>
    </SceneShell>
  );
}

function CloseScene() {
  return (
    <SceneShell className="close-scene">
      <motion.div
        className="close-rings"
        animate={{ rotate: 360 }}
        transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
      >
        <span /><span /><span />
      </motion.div>
      <motion.div
        className="close-content"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.22, duration: 0.9 }}
      >
        <div className="close-icon"><Waves size={34} /></div>
        <BrandMark compact />
        <h1>
          チームの成長を、
          <br />
          <span>毎日の記録から。</span>
        </h1>
        <div className="close-line" />
        <p>記録をつなぐ。挑戦を育てる。</p>
        <span className="close-url">SWIMTRACK / TEAM PERFORMANCE</span>
      </motion.div>
    </SceneShell>
  );
}

function ProgressBar({ scene }: { scene: number }) {
  const total = Object.values(SCENE_DURATIONS).length;
  return (
    <div className="video-progress" aria-label={`Scene ${scene + 1} of ${total}`}>
      {Array.from({ length: total }).map((_, index) => (
        <span key={index} className={index <= scene ? 'active' : ''} />
      ))}
    </div>
  );
}
