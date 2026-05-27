"use client";

import { useEffect, useState, useCallback } from "react";
import {
  UserPlus,
  AlertCircle,
  Shield,
  MoreVertical,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { DataTable } from "@/components/ui/data-table";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string;
  avatarUrl: string | null;
}

const ROLE_BADGE: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  OWNER: "info",
  ADMIN: "warning",
  MEMBER: "default",
};

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
};

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [newRole, setNewRole] = useState("");
  const [saving, setSaving] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", role: "MEMBER" });

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/team");
      if (!res.ok) throw new Error("Failed to load team members");
      const json = await res.json();
      setMembers(json.members ?? json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.email.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inviteForm),
      });
      if (!res.ok) throw new Error("Failed to send invite");
      setInviteModalOpen(false);
      setInviteForm({ email: "", role: "MEMBER" });
      fetchMembers();
    } catch {
      alert("Failed to send invite. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const openRoleModal = (member: TeamMember) => {
    setSelectedMember(member);
    setNewRole(member.role);
    setRoleModalOpen(true);
  };

  const handleChangeRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember || newRole === selectedMember.role) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/team/${selectedMember.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error("Failed to update role");
      setRoleModalOpen(false);
      setSelectedMember(null);
      fetchMembers();
    } catch {
      alert("Failed to update role. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (member: TeamMember) => {
    if (member.role === "OWNER") {
      alert("Cannot remove the account owner.");
      return;
    }
    if (
      !confirm(
        `Are you sure you want to remove ${member.name} from the team?`
      )
    )
      return;
    try {
      const res = await fetch(`/api/team/${member.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove member");
      fetchMembers();
    } catch {
      alert("Failed to remove team member.");
    }
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const columns = [
    {
      key: "name",
      header: "Member",
      render: (m: TeamMember) => (
        <div className="flex items-center gap-3">
          {m.avatarUrl ? (
            <img
              src={m.avatarUrl}
              alt={m.name}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-600">
              {getInitials(m.name)}
            </div>
          )}
          <div>
            <p className="font-medium text-gray-900">{m.name}</p>
            <p className="text-xs text-gray-500">{m.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (m: TeamMember) => (
        <Badge variant={ROLE_BADGE[m.role] ?? "default"}>
          {ROLE_LABELS[m.role] ?? m.role}
        </Badge>
      ),
    },
    {
      key: "joinedAt",
      header: "Joined",
      render: (m: TeamMember) => (
        <span className="text-gray-500">{formatDate(m.joinedAt)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (m: TeamMember) => (
        <div className="flex items-center justify-end gap-1">
          {m.role !== "OWNER" && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  openRoleModal(m);
                }}
                title="Change role"
              >
                <Shield className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(m);
                }}
                title="Remove member"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="mb-4 h-12 w-12 text-red-400" />
        <h2 className="text-lg font-semibold text-gray-900">
          Failed to load team members
        </h2>
        <p className="mt-1 text-sm text-gray-500">{error}</p>
        <Button className="mt-4" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your team members and their roles.
          </p>
        </div>
        <Button onClick={() => setInviteModalOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Invite Member
        </Button>
      </div>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <EmptyState
            title="No team members"
            description="Invite team members to help manage your reputation."
            actionLabel="Invite Member"
            onAction={() => setInviteModalOpen(true)}
            icon={<UserPlus className="h-12 w-12" />}
          />
        ) : (
          <DataTable<TeamMember & Record<string, unknown>>
            columns={columns}
            data={members as (TeamMember & Record<string, unknown>)[]}
            keyField="id"
          />
        )}
      </Card>

      {/* Invite Modal */}
      <Modal
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        title="Invite Team Member"
      >
        <form onSubmit={handleInvite} className="space-y-4">
          <Input
            label="Email Address"
            id="invite-email"
            type="email"
            required
            value={inviteForm.email}
            onChange={(e) =>
              setInviteForm({ ...inviteForm, email: e.target.value })
            }
            placeholder="colleague@company.com"
          />
          <Select
            label="Role"
            id="invite-role"
            value={inviteForm.role}
            onChange={(e) =>
              setInviteForm({ ...inviteForm, role: e.target.value })
            }
            options={[
              { value: "MEMBER", label: "Member" },
              { value: "ADMIN", label: "Admin" },
            ]}
          />
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs font-medium text-gray-600 mb-2">
              Role permissions:
            </p>
            <ul className="space-y-1 text-xs text-gray-500">
              <li>
                <strong className="text-gray-700">Member</strong> - View
                data, manage customers, respond to feedback
              </li>
              <li>
                <strong className="text-gray-700">Admin</strong> - All
                member permissions + manage team, settings, and billing
              </li>
            </ul>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setInviteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Send Invite
            </Button>
          </div>
        </form>
      </Modal>

      {/* Change Role Modal */}
      <Modal
        open={roleModalOpen}
        onClose={() => setRoleModalOpen(false)}
        title="Change Role"
      >
        {selectedMember && (
          <form onSubmit={handleChangeRole} className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Member</p>
              <p className="text-sm font-medium text-gray-900">
                {selectedMember.name}
              </p>
              <p className="text-xs text-gray-500">{selectedMember.email}</p>
            </div>
            <Select
              label="New Role"
              id="new-role"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              options={[
                { value: "MEMBER", label: "Member" },
                { value: "ADMIN", label: "Admin" },
              ]}
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRoleModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                Update Role
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
