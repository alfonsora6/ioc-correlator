import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export function RegisterPage() {
  const nav = useNavigate();
  const setToken = useAuthStore((s) => s.setAccessToken);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post<{ access_token: string }>("/api/v1/auth/register", {
        email,
        password,
        full_name: fullName,
        tenant_name: tenantName,
      });
      setToken(data.access_token);
      toast.success("Account created");
      nav("/");
    } catch {
      toast.error("Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-950 to-indigo-950 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create your workspace</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="tn">Tenant name</Label>
              <Input id="tn" value={tenantName} onChange={(e) => setTenantName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fn">Full name</Label>
              <Input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "Creating…" : "Create account"}
            </Button>
            <div className="text-center text-sm text-slate-300">
              Already have an account?{" "}
              <Link className="text-brand-500 hover:underline" to="/login">
                Sign in
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
