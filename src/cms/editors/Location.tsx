// Reused from Premium-website @ 080ea485; original fields and editing logic retained.
// ERP-local presentation, capability controls, scoped API, and isolated previews; no website providers/CSS.
import { useEffect, useState } from "react";
import {CmsEditorFrame as AdminLayout} from "@/cms/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {useCmsClient,useCmsEditor,Button,CmsHtmlPreview} from "@/cms/context";
import {useAuth} from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Save, Info, Map, Navigation } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const AdminLocation = () => {
  const api=useCmsClient(); const {confirmDelete}=useCmsEditor(); const {can:canPermission}=useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const [settings, setSettings] = useState({
    event_location: "",
    contact_address: "",
    map_latitude: "30.0444",
    map_longitude: "31.2357",
    map_zoom: "15",
    map_marker_title: "",
    map_embed_url: "",
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const { data, error } = await api
      .from("site_settings")
      .select("setting_key, setting_value")
      .in("setting_key", [
        "event_location",
        "contact_address",
        "map_latitude",
        "map_longitude",
        "map_zoom",
        "map_marker_title",
        "map_embed_url",
      ]);

    if (error) {
      toast({
        title: "Error loading settings",
        description: error.message,
        variant: "destructive",
      });
    } else if (data) {
      const settingsObj: any = {};
      data.forEach((item) => {
        settingsObj[item.setting_key] = item.setting_value || "";
      });
      setSettings((prev) => ({ ...prev, ...settingsObj }));
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(settings).map(([key, value]) => ({
        setting_key: key,
        setting_value: value,
      }));

      for (const update of updates) {
        const { error } = await api
          .from("site_settings")
          .upsert(
            {
              setting_key: update.setting_key,
              setting_value: update.setting_value,
              setting_type: "text",
              category: "location",
              description: getSettingDescription(update.setting_key),
            },
            { onConflict: "setting_key" }
          );

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Location settings saved successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error saving settings",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getSettingDescription = (key: string) => {
    const descriptions: { [key: string]: string } = {
      event_location: "Event Location Name",
      contact_address: "Contact Address",
      map_latitude: "Map Latitude",
      map_longitude: "Map Longitude",
      map_zoom: "Map Zoom Level",
      map_marker_title: "Map Marker Title",
      map_embed_url: "Map Embed URL",
    };
    return descriptions[key] || key;
  };

  const handleMapClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Convert click position to approximate coordinates
    // This is a simplified conversion - for production, you'd want a proper map library
    const centerLat = parseFloat(settings.map_latitude) || 30.0444;
    const centerLng = parseFloat(settings.map_longitude) || 31.2357;
    const zoom = parseFloat(settings.map_zoom) || 15;

    // Calculate offset from center (simplified)
    const pixelOffsetX = x - rect.width / 2;
    const pixelOffsetY = y - rect.height / 2;

    // Convert to degrees (rough approximation)
    const degreesPerPixel = 0.01 / Math.pow(2, zoom - 10);
    const newLng = centerLng + (pixelOffsetX * degreesPerPixel);
    const newLat = centerLat - (pixelOffsetY * degreesPerPixel);

    setSettings(prev => ({
      ...prev,
      map_latitude: newLat.toFixed(6),
      map_longitude: newLng.toFixed(6)
    }));
  };

  const generateGoogleMapsEmbed = () => {
    const { map_latitude, map_longitude, map_zoom } = settings;
    if (map_latitude && map_longitude) {
      const embedUrl = `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3453!2d${map_longitude}!3d${map_latitude}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2z${btoa(map_latitude + ',' + map_longitude)}!5e0!3m2!1sen!2seg!4v${Date.now()}&zoom=${map_zoom || 15}`;
      setSettings(prev => ({ ...prev, map_embed_url: embedUrl }));
    }
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
            <h2 className="text-2xl font-semibold text-crm-primary-text">Location & Map Settings</h2>
            <p className="text-muted-foreground mt-2">
              Manage event location and interactive map settings
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving} cmsAction="write">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Location Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Location Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="event_location">Event Location Name</Label>
                <Input
                  id="event_location"
                  value={settings.event_location}
                  onChange={(e) =>
                    setSettings({ ...settings, event_location: e.target.value })
                  }
                  placeholder="e.g., Cairo International Convention Center"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_address">Full Address</Label>
                <Textarea
                  id="contact_address"
                  value={settings.contact_address}
                  onChange={(e) =>
                    setSettings({ ...settings, contact_address: e.target.value })
                  }
                  placeholder="Enter the complete address"
                  className="min-h-[80px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="map_marker_title">Map Marker Title</Label>
                <Input
                  id="map_marker_title"
                  value={settings.map_marker_title}
                  onChange={(e) =>
                    setSettings({ ...settings, map_marker_title: e.target.value })
                  }
                  placeholder="Title shown on map marker"
                />
              </div>
            </CardContent>
          </Card>

          {/* Interactive Map */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Map className="h-5 w-5" />
                Interactive Map
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Click anywhere on the map below to move the pin to that location. The coordinates will update automatically.
                </AlertDescription>
              </Alert>

              {/* Interactive Map Container */}
              <div className="w-full h-64 bg-gray-100 rounded-lg border relative overflow-hidden">
                <div
                  className="w-full h-full cursor-crosshair relative"
                  onClick={handleMapClick}
                >
                  {/* Google Maps iframe as background */}
                  <iframe
                    src={`https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3453!2d${settings.map_longitude}!3d${settings.map_latitude}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2z${btoa((settings.map_latitude || '30.0444') + ',' + (settings.map_longitude || '31.2357'))}!5e0!3m2!1sen!2seg!4v${Date.now()}&zoom=${settings.map_zoom || 15}`}
                    width="100%"
                    height="100%"
                    style={{ border: 0, pointerEvents: 'none' }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    title="Location Map" sandbox="allow-scripts allow-same-origin"
                  ></iframe>

                  {/* Transparent clickable overlay */}
                  <div className="absolute inset-0 bg-transparent hover:bg-blue-500 hover:bg-opacity-10 transition-colors" />

                  {/* Center pin indicator */}
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                    <div className="relative">
                      <MapPin className="h-8 w-8 text-red-500 drop-shadow-lg animate-bounce" />
                      <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-red-500 rounded-full opacity-30"></div>
                    </div>
                  </div>

                  {/* Coordinates display */}
                  <div className="absolute bottom-2 left-2 bg-white bg-opacity-95 px-3 py-2 rounded-lg shadow-lg border">
                    <p className="text-xs font-medium text-gray-700">
                      📍 Lat: {parseFloat(settings.map_latitude || '0').toFixed(4)}<br/>
                      📍 Lng: {parseFloat(settings.map_longitude || '0').toFixed(4)}
                    </p>
                  </div>

                  {/* Click instruction */}
                  <div className="absolute top-2 left-2 bg-blue-500 text-white px-3 py-2 rounded-lg shadow-lg">
                    <p className="text-xs font-medium flex items-center gap-1">
                      <Navigation className="h-3 w-3" />
                      Click to move pin
                    </p>
                  </div>
                </div>
              </div>

              {/* Manual Coordinates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="map_latitude">Latitude</Label>
                  <Input
                    id="map_latitude"
                    type="number"
                    step="0.000001"
                    value={settings.map_latitude}
                    onChange={(e) =>
                      setSettings({ ...settings, map_latitude: e.target.value })
                    }
                    placeholder="30.0444"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="map_longitude">Longitude</Label>
                  <Input
                    id="map_longitude"
                    type="number"
                    step="0.000001"
                    value={settings.map_longitude}
                    onChange={(e) =>
                      setSettings({ ...settings, map_longitude: e.target.value })
                    }
                    placeholder="31.2357"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="map_zoom">Zoom Level (1-20)</Label>
                <Input
                  id="map_zoom"
                  type="number"
                  min="1"
                  max="20"
                  value={settings.map_zoom}
                  onChange={(e) =>
                    setSettings({ ...settings, map_zoom: e.target.value })
                  }
                  placeholder="15"
                />
              </div>

              <Button
                onClick={generateGoogleMapsEmbed}
                variant="outline"
                className="w-full"
              >
                <Map className="h-4 w-4 mr-2" />
                Generate Embed URL
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Quick Location Presets */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Location Presets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                variant="outline"
                onClick={() => setSettings(prev => ({
                  ...prev,
                  map_latitude: "30.0626",
                  map_longitude: "31.2497",
                  event_location: "Cairo International Convention Center",
                  map_marker_title: "Cairo International Convention Center"
                }))}
              >
                <MapPin className="h-4 w-4 mr-2" />
                Cairo Convention Center
              </Button>

              <Button
                variant="outline"
                onClick={() => setSettings(prev => ({
                  ...prev,
                  map_latitude: "30.0444",
                  map_longitude: "31.2357",
                  event_location: "Downtown Cairo",
                  map_marker_title: "Downtown Cairo"
                }))}
              >
                <MapPin className="h-4 w-4 mr-2" />
                Downtown Cairo
              </Button>

              <Button
                variant="outline"
                onClick={() => setSettings(prev => ({
                  ...prev,
                  map_latitude: "30.0131",
                  map_longitude: "31.2089",
                  event_location: "New Cairo",
                  map_marker_title: "New Cairo"
                }))}
              >
                <MapPin className="h-4 w-4 mr-2" />
                New Cairo
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Map Embed URL */}
        <Card>
          <CardHeader>
            <CardTitle>Generated Map Embed URL</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="map_embed_url">Google Maps Embed URL</Label>
              <Textarea
                id="map_embed_url"
                value={settings.map_embed_url}
                onChange={(e) =>
                  setSettings({ ...settings, map_embed_url: e.target.value })
                }
                placeholder="Auto-generated from coordinates above, or paste custom embed URL"
                className="min-h-[100px] font-mono text-sm"
              />
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                The embed URL is automatically generated from your coordinates. You can also paste a custom Google Maps embed URL here.
                To get a custom URL: Go to Google Maps → Find location → Share → Embed a map → Copy HTML.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminLocation;
