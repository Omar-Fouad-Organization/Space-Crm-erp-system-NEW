// Reused from Premium-website @ 080ea485; original fields and editing logic retained.
// ERP-local presentation, capability controls, scoped API, and isolated previews; no website providers/CSS.
import { useEffect, useState } from "react";
import {CmsEditorFrame as AdminLayout} from "@/cms/context";
import { Card, CardContent } from "@/components/ui/card";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {useCmsClient,useCmsEditor,Button,CmsHtmlPreview} from "@/cms/context";
import {useAuth} from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Save } from "lucide-react";

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  display_order: number;
  is_active: boolean;
}

const AdminFAQs = () => {
  const api=useCmsClient(); const {confirmDelete}=useCmsEditor(); const {can:canPermission}=useAuth();
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingFAQ, setEditingFAQ] = useState<FAQ | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadFAQs();
  }, []);

  const loadFAQs = async () => {
    const { data, error } = await api
      .from("faqs")
      .select("*")
      .order("display_order", { ascending: true });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load FAQs",
        variant: "destructive",
      });
    } else {
      setFaqs(data || []);
    }
    setLoading(false);
  };

  const handleNew = () => {
    setEditingFAQ({
      id: "",
      question: "",
      answer: "",
      category: "general",
      display_order: faqs.length + 1,
      is_active: true,
    });
    setIsNew(true);
    setIsDialogOpen(true);
  };

  const handleEdit = (faq: FAQ) => {
    setEditingFAQ(faq);
    setIsNew(false);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingFAQ) return;

    if (isNew) {
      const { error } = await api.from("faqs").insert({
        question: editingFAQ.question,
        answer: editingFAQ.answer,
        category: editingFAQ.category,
        display_order: editingFAQ.display_order,
        is_active: editingFAQ.is_active,
      });

      if (error) {
        toast({
          title: "Error",
          description: "Failed to create FAQ",
          variant: "destructive",
        });
        return;
      }
    } else {
      const { error } = await api
        .from("faqs")
        .update({
          question: editingFAQ.question,
          answer: editingFAQ.answer,
          category: editingFAQ.category,
          display_order: editingFAQ.display_order,
          is_active: editingFAQ.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingFAQ.id);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update FAQ",
          variant: "destructive",
        });
        return;
      }
    }

    toast({
      title: "Success",
      description: `FAQ ${isNew ? "created" : "updated"} successfully`,
    });
    loadFAQs();
    setIsDialogOpen(false);
    setEditingFAQ(null);
  };

  const handleDelete = async (id: string) => {
    if (!await confirmDelete("Are you sure you want to delete this FAQ?")) return;

    const { error } = await api.from("faqs").delete().eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete FAQ",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "FAQ deleted successfully",
      });
      loadFAQs();
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
            <h2 className="text-2xl font-semibold text-crm-primary-text">FAQs Management</h2>
            <p className="text-muted-foreground mt-2">
              Manage frequently asked questions
            </p>
          </div>
          <Button cmsAction="create" onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            Add FAQ
          </Button>
        </div>

        <div className="space-y-4">
          {faqs.map((faq) => (
            <Card key={faq.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">{faq.question}</h3>
                    <p className="text-muted-foreground mb-3">{faq.answer}</p>
                    <div className="flex gap-2 text-sm">
                      <span className="bg-accent px-2 py-1 rounded">{faq.category}</span>
                      {!faq.is_active && (
                        <span className="bg-destructive/10 text-destructive px-2 py-1 rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" aria-label={"Edit " + faq.question} onClick={() => handleEdit(faq)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      aria-label={"Delete " + faq.question} onClick={() => handleDelete(faq.id)} cmsAction="delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{isNew ? "Add New FAQ" : "Edit FAQ"}</DialogTitle>
            </DialogHeader>
            {editingFAQ && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Question</Label>
                  <Input
                    value={editingFAQ.question}
                    onChange={(e) =>
                      setEditingFAQ({ ...editingFAQ, question: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Answer</Label>
                  <Textarea
                    value={editingFAQ.answer}
                    onChange={(e) =>
                      setEditingFAQ({ ...editingFAQ, answer: e.target.value })
                    }
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input
                    value={editingFAQ.category}
                    onChange={(e) =>
                      setEditingFAQ({ ...editingFAQ, category: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Display Order</Label>
                  <Input
                    type="number"
                    value={editingFAQ.display_order}
                    onChange={(e) =>
                      setEditingFAQ({
                        ...editingFAQ,
                        display_order: parseInt(e.target.value),
                      })
                    }
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={editingFAQ.is_active}
                    onChange={(e) =>
                      setEditingFAQ({ ...editingFAQ, is_active: e.target.checked })
                    }
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>

                <Button onClick={handleSave} className="w-full" cmsAction="write">
                  <Save className="h-4 w-4 mr-2" />
                  {isNew ? "Create FAQ" : "Save Changes"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminFAQs;
