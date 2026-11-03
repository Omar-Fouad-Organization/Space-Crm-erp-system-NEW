// Reused from Premium-website @ 080ea485; original fields and editing logic retained.
// ERP-local presentation, capability controls, scoped API, and isolated previews; no website providers/CSS.
import { useEffect, useState } from "react";
import {CmsEditorFrame as AdminLayout} from "@/cms/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {useCmsClient,useCmsEditor,Button,CmsHtmlPreview} from "@/cms/context";
import {useAuth} from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Save, Palette } from "lucide-react";

interface ColorSetting {
  id: string;
  setting_key: string;
  setting_value: string;
  description: string;
}

const AdminDesign = () => {
  const api=useCmsClient(); const {confirmDelete}=useCmsEditor(); const {can:canPermission}=useAuth();
  const [colors, setColors] = useState<ColorSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadColors();
  }, []);

  const loadColors = async () => {
    const { data, error } = await api
      .from("site_settings")
      .select("*")
      .eq("category", "colors");

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load color settings",
        variant: "destructive",
      });
    } else {
      setColors(data || []);
    }
    setLoading(false);
  };

  const handleChange = (key: string, value: string) => {
    setColors(colors.map((c) => (c.setting_key === key ? { ...c, setting_value: value } : c)));
  };

  const handleSave = async () => {
    setSaving(true);

    for (const color of colors) {
      const { error } = await api
        .from("site_settings")
        .update({
          setting_value: color.setting_value,
          updated_at: new Date().toISOString()
        })
        .eq("id", color.id);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update colors",
          variant: "destructive",
        });
        setSaving(false);
        return;
      }
    }

    toast({
      title: "Success",
      description: "Branding values saved in the CMS. Public styling follows the reviewed website binding configuration.",
    });

    setSaving(false);
  };

  const hslToHex = (hsl: string) => {
    if (/^#[a-f0-9]{3}(?:[a-f0-9]{3})?$/i.test(hsl)) return hsl;
    const [h, s, l] = hsl.split(" ").map((v) => parseFloat(v.replace("%", "")));
    const hDecimal = h / 360;
    const sDecimal = s / 100;
    const lDecimal = l / 100;

    let r, g, b;

    if (sDecimal === 0) {
      r = g = b = lDecimal;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };

      const q = lDecimal < 0.5 ? lDecimal * (1 + sDecimal) : lDecimal + sDecimal - lDecimal * sDecimal;
      const p = 2 * lDecimal - q;

      r = hue2rgb(p, q, hDecimal + 1 / 3);
      g = hue2rgb(p, q, hDecimal);
      b = hue2rgb(p, q, hDecimal - 1 / 3);
    }

    const toHex = (x: number) => {
      const hex = Math.round(x * 255).toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-crm-primary-text">Design & Colors</h2>
            <p className="text-muted-foreground mt-2">
              Customize your website's color scheme and branding
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving} cmsAction="write">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Brand Colors
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {colors.map((color) => (
                <div key={color.id} className="space-y-3">
                  <Label htmlFor={color.setting_key}>
                    {color.description || color.setting_key}
                  </Label>
                  <div className="flex gap-3 items-center">
                    <div
                      className="w-16 h-16 rounded-lg border-2 shadow-sm"
                      style={{ backgroundColor: hslToHex(color.setting_value) }}
                    />
                    <div className="flex-1 space-y-2">
                      <Input
                        id={color.setting_key}
                        value={color.setting_value}
                        onChange={(e) => handleChange(color.setting_key, e.target.value)}
                        placeholder="e.g., 130 45% 30%"
                      />
                      <p className="text-xs text-muted-foreground">
                        HSL format: hue saturation% lightness%
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-6 border-t">
              <h3 className="font-semibold mb-4">Color Preview</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {colors.map((color) => (
                  <div key={color.id} className="text-center">
                    <div
                      className="w-full h-24 rounded-lg border-2 shadow-sm mb-2"
                      style={{ backgroundColor: hslToHex(color.setting_value) }}
                    />
                    <p className="text-sm font-medium">{color.description?.split(" ")[0]}</p>
                    <p className="text-xs text-muted-foreground">{hslToHex(color.setting_value)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-accent/50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">💡 Tips</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• HSL format: "hue saturation% lightness%" (e.g., "130 45% 30%")</li>
                <li>• Hue: 0-360 (color wheel position)</li>
                <li>• Saturation: 0-100% (color intensity)</li>
                <li>• Lightness: 0-100% (brightness)</li>
                <li>• Public branding applies only after the website binding flag is reviewed and enabled. ERP styling is unaffected.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminDesign;
