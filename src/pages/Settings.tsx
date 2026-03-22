import { useAuth } from "@/contexts/AuthContext";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader } from "@/components/Loader";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user, userEmail, loading } = useAuth();
  const [phone, setPhone] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(true);
  const [savingPhone, setSavingPhone] = useState(false);

  useEffect(() => {
    const loadPhone = async () => {
      if (!user?.id) {
        setPhoneLoading(false);
        return;
      }

      setPhoneLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("phone")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        toast.error("Could not load phone number");
      } else {
        setPhone(data?.phone ?? "");
      }

      setPhoneLoading(false);
    };

    loadPhone();
  }, [user?.id]);

  const handleSavePhone = async () => {
    if (!user?.id) return;

    const normalized = phone.trim();
    if (normalized && normalized.length < 7) {
      toast.error("Phone number is too short");
      return;
    }

    setSavingPhone(true);
    const { error } = await supabase
      .from("profiles")
      .update({ phone: normalized || null })
      .eq("user_id", user.id);

    setSavingPhone(false);

    if (error) {
      toast.error("Failed to save phone number");
      return;
    }

    toast.success("Phone number updated");
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader text="Loading settings..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <div className="container mx-auto px-4 py-8">
        <h1 className="font-display text-3xl font-bold text-foreground mb-8">Settings</h1>

        {/* User Account Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>View your account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Email Address</p>
              <p className="text-lg font-medium text-foreground">{userEmail || "—"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone Number</p>
              {phoneLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : (
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Enter phone number"
                    className="sm:max-w-xs"
                  />
                  <Button onClick={handleSavePhone} disabled={savingPhone} className="sm:w-auto">
                    {savingPhone ? "Saving..." : "Save"}
                  </Button>
                </div>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">User ID</p>
              <p className="text-sm font-mono text-foreground break-all">{user?.id || "—"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Account Created</p>
              <p className="text-sm text-foreground">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>Change your password to keep your account secure</CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
