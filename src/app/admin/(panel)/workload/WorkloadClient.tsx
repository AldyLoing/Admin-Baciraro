"use client";

import { useMemo } from "react";

type Member = { id: number; name: string; role: string };
type Task = { id: string; status: string; assigned_to: number | null };
type ProjectMember = { member_id: number; contribution_percent: number };

type Props = {
  members: Member[];
  tasks: Task[];
  projectMembers: ProjectMember[];
};

type MemberWorkload = {
  member: Member;
  pendingTasks: number;
  activeTasks: number;
  projectsCount: number;
  contributionPercent: number;
  workloadScore: number;
};

export default function WorkloadClient({ members, tasks, projectMembers }: Props) {
  const workloads = useMemo(() => {
    const pmByMember = new Map<number, ProjectMember[]>();
    projectMembers.forEach((pm) => {
      if (!pmByMember.has(pm.member_id)) pmByMember.set(pm.member_id, []);
      pmByMember.get(pm.member_id)!.push(pm);
    });

    return members
      .map((member): MemberWorkload => {
        const memberTasks = tasks.filter((t) => t.assigned_to === member.id);
        const pendingTasks = memberTasks.filter((t) => t.status === "pending").length;
        const activeTasks = memberTasks.filter((t) => t.status === "active").length;
        const memberPm = pmByMember.get(member.id) ?? [];
        const projectsCount = memberPm.length;
        const contributionPercent = memberPm.reduce((sum, pm) => sum + pm.contribution_percent, 0);
        const workloadScore = pendingTasks * 10 + activeTasks * 15 + contributionPercent;

        return { member, pendingTasks, activeTasks, projectsCount, contributionPercent, workloadScore };
      })
      .sort((a, b) => b.workloadScore - a.workloadScore);
  }, [members, tasks, projectMembers]);

  const maxScore = Math.max(...workloads.map((w) => w.workloadScore), 1);

  function getBarColor(score: number) {
    if (score < 40) return "bg-emerald-500";
    if (score <= 70) return "bg-yellow-500";
    return "bg-red-500";
  }

  function getBarLabel(score: number) {
    if (score < 40) return "Ringan";
    if (score <= 70) return "Sedang";
    return "Berat";
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-white">Workload Anggota</h1>
        <p className="text-white/50 mt-1">Ringkasan beban kerja setiap anggota berdasarkan tugas dan kontribusi project.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {workloads.map((w) => {
          const barWidth = Math.min((w.workloadScore / maxScore) * 100, 100);
          const displayWidth = Math.min(w.workloadScore, 100);
          return (
            <div key={w.member.id} className="bg-[#151515] rounded-xl border border-white/10 p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-[#D97A2B]/20 text-[#E9A64E] flex items-center justify-center text-sm font-semibold shrink-0">
                  {w.member.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white">{w.member.name}</p>
                  <p className="text-sm text-white/50">{w.member.role}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-2xl font-bold ${w.workloadScore < 40 ? "text-emerald-400" : w.workloadScore <= 70 ? "text-yellow-400" : "text-red-400"}`}>
                    {w.workloadScore}
                  </p>
                  <p className="text-xs text-white/40">{getBarLabel(w.workloadScore)}</p>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between text-xs text-white/40 mb-1.5">
                  <span>Workload</span>
                  <span>{w.workloadScore} / 100</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${getBarColor(w.workloadScore)}`}
                    style={{ width: `${displayWidth}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-white">{w.pendingTasks}</p>
                  <p className="text-xs text-white/50">Pending</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-blue-400">{w.activeTasks}</p>
                  <p className="text-xs text-white/50">Aktif</p>
                </div>
              </div>

              <div className="border-t border-white/5 pt-3">
                <p className="text-xs text-white/40 mb-2">Project ({w.projectsCount})</p>
                {w.projectsCount === 0 ? (
                  <p className="text-xs text-white/30">Belum terlibat di project</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {projectMembers
                      .filter((pm) => pm.member_id === w.member.id)
                      .map((pm, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 text-xs text-white/60">
                          {pm.contribution_percent}%
                        </span>
                      ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
