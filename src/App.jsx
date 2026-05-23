import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Play, RotateCcw, Gauge, ShieldCheck, AlertTriangle } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function ShuttleDescentSimulation() {
  const [bankDeg, setBankDeg] = useState(35);
  const [ldRatio, setLdRatio] = useState(1.05);
  const [entrySpeed, setEntrySpeed] = useState(7500);
  const [mass, setMass] = useState(90000);
  const [area, setArea] = useState(250);

  const sim = useMemo(() => {
    const deg = Math.PI / 180;
    const bank = bankDeg * deg;
    const dt = 1.0;
    const maxSteps = 1800;
    const R = 6_371_000;
    const mu = 3.986004418e14;
    const rho0 = 1.225;
    const H = 7200;
    const Cd = 1.35;
    const Cl = Cd * ldRatio;
    const qMax = 42_000;
    const nMax = 2.5;
    const touchdownV = 105;

    let x = 0;
    let h = 120_000;
    let vx = entrySpeed;
    let vz = -350;
    let m = mass;

    const points = [];
    let maxQ = 0;
    let maxN = 0;
    let minEnergy = Infinity;
    let status = "Nominal";

    for (let i = 0; i < maxSteps; i++) {
      const t = i * dt;
      const r = R + Math.max(h, 0);
      const g = mu / (r * r);
      const v = Math.hypot(vx, vz);
      const rho = rho0 * Math.exp(-Math.max(h, 0) / H);
      const q = 0.5 * rho * v * v;
      const D = q * area * Cd;
      const L = q * area * Cl * Math.cos(bank);
      const axDrag = -(D / m) * (vx / v);
      const azDrag = -(D / m) * (vz / v);
      const axLift = -(L / m) * (vz / v);
      const azLift = (L / m) * (vx / v);
      const ax = axDrag + axLift;
      const az = azDrag + azLift - g;
      const gamma = Math.asin(vz / Math.max(v, 1)) / deg;
      const energy = 0.5 * v * v - mu / r;
      const nLoad = Math.hypot(D, L) / (m * 9.80665);
      maxQ = Math.max(maxQ, q);
      maxN = Math.max(maxN, nLoad);
      minEnergy = Math.min(minEnergy, energy);

      if (i % 10 === 0) {
        points.push({
          t,
          rangeKm: x / 1000,
          altKm: h / 1000,
          speed: v,
          q: q / 1000,
          n: nLoad,
          gamma,
          energyMJ: energy / 1_000_000,
          admissible: q <= qMax && nLoad <= nMax && h >= 0,
        });
      }

      if (q > qMax || nLoad > nMax) status = "Constraint exceeded";
      if (h <= 0) break;

      vx += ax * dt;
      vz += az * dt;
      x += vx * dt;
      h += vz * dt;
      m += 0; // unpowered descent: T = 0 and m_dot = 0
    }

    const last = points[points.length - 1];
    const landed = last?.altKm <= 0.1;
    const landingError = last ? Math.abs(last.speed - touchdownV) : 0;
    const admissible = status === "Nominal" && landed;

    return {
      points,
      maxQ,
      maxN,
      minEnergy,
      last,
      landed,
      landingError,
      admissible,
      status: admissible ? "Admissible trajectory" : status,
    };
  }, [bankDeg, ldRatio, entrySpeed, mass, area]);

  const trajectory = sim.points;
  const maxRange = Math.max(...trajectory.map((p) => p.rangeKm), 1);
  const maxAlt = Math.max(...trajectory.map((p) => p.altKm), 1);
  const last = sim.last ?? trajectory[trajectory.length - 1];
  const vehicleX = last ? (last.rangeKm / maxRange) * 100 : 0;
  const vehicleY = last ? 92 - (last.altKm / maxAlt) * 82 : 92;

  const reset = () => {
    setBankDeg(35);
    setLdRatio(1.05);
    setEntrySpeed(7500);
    setMass(90000);
    setArea(250);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-5 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="relative overflow-hidden rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950 p-6 shadow-2xl">
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_70%_20%,rgba(56,189,248,.45),transparent_35%),radial-gradient(circle_at_15%_80%,rgba(249,115,22,.35),transparent_30%)]" />
          <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Unpowered shuttle-style descent</p>
              <h1 className="mt-2 text-3xl md:text-5xl font-black tracking-tight">Trajectory Constraint Simulation</h1>
              <p className="mt-3 max-w-2xl text-slate-300">
                A simplified 2D flight model showing the set of admissible descent states under lift, drag, gravity,
                dynamic pressure, and load constraints. Thrust is disabled: T = 0 and ṁ = 0.
              </p>
            </div>
            <div className="rounded-2xl border border-cyan-400/30 bg-black/35 px-5 py-4 shadow-lg">
              <div className="text-xs uppercase tracking-widest text-slate-400">State membership</div>
              <div className="mt-2 flex items-center gap-2 text-xl font-bold">
                {sim.admissible ? <ShieldCheck className="text-emerald-300" /> : <AlertTriangle className="text-amber-300" />}
                {sim.status}
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <aside className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Controls</h2>
              <button
                onClick={reset}
                className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/10"
              >
                <RotateCcw size={16} /> Reset
              </button>
            </div>

            <Control label="Bank angle φ" value={bankDeg} suffix="°" min={0} max={75} step={1} onChange={setBankDeg} />
            <Control label="Lift-to-drag ratio L/D" value={ldRatio} min={0.2} max={2.0} step={0.05} onChange={setLdRatio} />
            <Control label="Entry speed" value={entrySpeed} suffix=" m/s" min={5500} max={8000} step={100} onChange={setEntrySpeed} />
            <Control label="Vehicle mass" value={mass} suffix=" kg" min={60000} max={120000} step={5000} onChange={setMass} />
            <Control label="Reference area" value={area} suffix=" m²" min={150} max={400} step={10} onChange={setArea} />

            <div className="mt-6 rounded-2xl border border-cyan-300/20 bg-slate-900/60 p-4 font-mono text-sm leading-7 text-cyan-100">
              <div>A = &#123; x(t) | q ≤ q_max ∧ n ≤ n_max ∧ h ≥ 0 &#125;</div>
              <div>x = (r, v, m)</div>
              <div>T = 0</div>
              <div>ṁ = 0</div>
            </div>
          </aside>

          <main className="space-y-5">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900 p-4 shadow-xl">
              <div className="mb-3 flex items-center gap-2 text-slate-300">
                <Play size={18} className="text-cyan-300" />
                <span className="font-semibold">Trajectory display</span>
              </div>
              <svg viewBox="0 0 100 56" className="h-[360px] w-full rounded-2xl bg-gradient-to-b from-slate-950 via-blue-950 to-slate-900">
                <defs>
                  <linearGradient id="path" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="70%" stopColor="#facc15" />
                    <stop offset="100%" stopColor="#fb7185" />
                  </linearGradient>
                </defs>
                {[...Array(80)].map((_, i) => (
                  <circle
                    key={i}
                    cx={(i * 37) % 100}
                    cy={(i * 19) % 42}
                    r={(i % 5) * 0.025 + 0.05}
                    fill="white"
                    opacity="0.45"
                  />
                ))}
                <path d="M0 51 C20 47, 35 48, 55 51 S82 54, 100 49 L100 56 L0 56 Z" fill="#0f172a" />
                <path
                  d={trajectory
                    .map((p, i) => {
                      const px = (p.rangeKm / maxRange) * 94 + 3;
                      const py = 50 - (p.altKm / maxAlt) * 42;
                      return `${i === 0 ? "M" : "L"} ${px.toFixed(2)} ${py.toFixed(2)}`;
                    })
                    .join(" ")}
                  fill="none"
                  stroke="url(#path)"
                  strokeWidth="0.55"
                  strokeLinecap="round"
                />
                <motion.g
                  initial={false}
                  animate={{ x: vehicleX * 0.94 + 3, y: vehicleY * 0.52 }}
                  transition={{ type: "spring", stiffness: 90, damping: 18 }}
                >
                  <path d="M-2 0 L2 -0.7 L1.2 0 L2 0.7 Z" fill="#e2e8f0" />
                  <circle cx="0" cy="0" r="1.2" fill="none" stroke="#38bdf8" strokeWidth="0.25" opacity="0.8" />
                </motion.g>
                <text x="4" y="7" fill="#67e8f9" fontSize="2.3" fontFamily="monospace">
                  Ψ descent: gravity + lift + drag, no thrust
                </text>
                <text x="4" y="53" fill="#94a3b8" fontSize="1.7" fontFamily="monospace">
                  range ≈ {last?.rangeKm.toFixed(0)} km · altitude ≈ {last?.altKm.toFixed(1)} km · velocity ≈ {last?.speed.toFixed(0)} m/s
                </text>
              </svg>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              <Metric icon={<Gauge />} label="Max dynamic pressure" value={`${(sim.maxQ / 1000).toFixed(1)} kPa`} />
              <Metric icon={<Gauge />} label="Max load factor" value={`${sim.maxN.toFixed(2)} g`} />
              <Metric icon={<Gauge />} label="Final speed" value={`${last?.speed.toFixed(0) ?? 0} m/s`} />
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <Chart title="Altitude vs. range" data={trajectory} x="rangeKm" y="altKm" yName="Altitude km" />
              <Chart title="Dynamic pressure over time" data={trajectory} x="t" y="q" yName="q kPa" />
            </div>
          </main>
        </section>
      </div>
    </div>
  );
}

function Control({ label, value, suffix = "", min, max, step, onChange }) {
  return (
    <label className="mt-5 block">
      <div className="mb-2 flex justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="font-mono text-cyan-200">{value}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-cyan-400"
      />
    </label>
  );
}

function Metric({ icon, label, value }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
      <div className="flex items-center gap-2 text-cyan-300">{icon}<span className="text-sm uppercase tracking-widest">{label}</span></div>
      <div className="mt-3 text-3xl font-black">{value}</div>
    </div>
  );
}

function Chart({ title, data, x, y, yName }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
      <h3 className="mb-3 font-bold text-slate-100">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 15, bottom: 10, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.18} />
            <XAxis dataKey={x} tick={{ fill: "#94a3b8", fontSize: 12 }} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
            <Tooltip
              contentStyle={{ background: "#020617", border: "1px solid rgba(255,255,255,.14)", borderRadius: 14 }}
              labelStyle={{ color: "#e2e8f0" }}
            />
            <Line type="monotone" dataKey={y} name={yName} dot={false} strokeWidth={3} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

