import { api } from "@/lib/api";

class TemplateService {

    static async getCustomTemplateSummaries() {
        try {
            return await api.get<any>(`/api/v1/ppt/template-management/summary`);
        } catch (error) {
            console.error("Failed to get custom template summaries", error);
            throw error;
        }
    }

    static async getCustomTemplateDetails(templateId: string) {
        try {
            return await api.get<any>(`/api/v1/ppt/template-management/get-templates/${templateId}`);
        } catch (error) {
            console.error("Failed to get custom template details", error);
            throw error;
        }
    }

    static async deleteCustomTemplate(presentationId: string) {
        try {
            await api.delete<void>(`/api/v1/ppt/template-management/delete-templates/${presentationId}`);
            return { success: true };
        } catch (error) {
            console.error("Failed to delete custom template", error);
            throw error;
        }
    }
}

export default TemplateService;
