"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";
import Empty from "@workspace/ui/composed/empty";
import { getV1PublicDocumentList as queryDocumentList } from "@workspace/ui/services/user/user";
import { useTranslation } from "react-i18next";
import {
  DocumentButton,
  DocumentContent,
} from "@/sections/user/document/document-button";
import { getTutorialList } from "@/sections/user/document/tutorial";
import { TutorialButton } from "@/sections/user/document/tutorial-button";
import { useGlobalStore } from "@/stores/global";
import { getPlatform } from "@/utils/common";

const documentOrder: Record<string, number[]> = {
  新手入门: [1, 2, 3],
  客户端教程: [4, 5, 6, 15, 8, 14],
  常见问题: [9, 10, 11, 12, 13],
};
const clientTag = "客户端教程";
const clientLabels: Record<number, string> = {
  4: "Windows",
  5: "macOS",
  6: "Android",
  15: "iOS",
  8: "路由器 / 电视",
  14: "下载汇总",
};
const clientPlatformIds: Record<string, number[]> = {
  windows: [4],
  macos: [5],
  android: [6],
  ios: [15],
};

function sortDocuments(documents: API.Document[]) {
  const categories = Object.keys(documentOrder);
  [...documents]
    .sort((a, b) => (a.id || 0) - (b.id || 0))
    .forEach((document) => {
      (document.tags || []).forEach((tag) => {
        if (tag && !categories.includes(tag)) categories.push(tag);
      });
    });

  const primaryCategory = (document: API.Document) =>
    (document.tags || []).find(Boolean) || "";
  const categoryIndex = (document: API.Document) => {
    const index = categories.indexOf(primaryCategory(document));
    return index < 0 ? categories.length : index;
  };
  const documentIndex = (document: API.Document) => {
    const configured = documentOrder[primaryCategory(document)] || [];
    const index = configured.indexOf(document.id || 0);
    return index < 0 ? configured.length + (document.id || 0) : index;
  };

  return [...documents].sort(
    (a, b) =>
      categoryIndex(a) - categoryIndex(b) ||
      documentIndex(a) - documentIndex(b) ||
      (a.id || 0) - (b.id || 0)
  );
}

export default function Document() {
  const { t, i18n } = useTranslation("document");
  const locale = i18n.language;
  const { common } = useGlobalStore();
  const showTutorial = common.subscribe?.show_tutorial !== false;

  const { data } = useQuery({
    queryKey: ["queryDocumentList"],
    queryFn: async () => {
      const response = await queryDocumentList();
      const list = sortDocuments(response.data.data?.list || []);
      return {
        tags: Array.from(
          new Set(
            list.reduce(
              (acc: string[], item) =>
                acc.concat((item.tags || []).filter(Boolean)),
              []
            )
          )
        ),
        list,
      };
    },
  });
  const { tags, list: DocumentList } = data || { tags: [], list: [] };
  const regularTags = tags.filter((tag) => tag !== clientTag);
  const regularDocuments = DocumentList.filter(
    (document) => !(document.tags || []).includes(clientTag)
  );
  const clientDocuments = DocumentList.filter((document) =>
    (document.tags || []).includes(clientTag)
  );
  const platformIds = clientPlatformIds[getPlatform()] || [];
  const selectedClient =
    clientDocuments.find((document) =>
      platformIds.includes(document.id || 0)
    ) || clientDocuments[0];

  const { data: TutorialList } = useQuery({
    queryKey: ["getTutorialList", locale],
    queryFn: async () => {
      const list = await getTutorialList();
      return list.get(locale);
    },
    enabled: showTutorial,
  });

  if (
    (!DocumentList || DocumentList.length === 0) &&
    (!TutorialList || TutorialList.length === 0)
  ) {
    return <Empty border />;
  }

  return (
    <div className="space-y-4">
      {DocumentList?.length > 0 && (
        <>
          <h2 className="flex items-center gap-1.5 font-semibold">
            {t("document", "Document")}
          </h2>
          <Tabs defaultValue={regularTags[0] || "all"}>
            <TabsList className="h-full flex-wrap">
              {regularTags.map((item) => (
                <TabsTrigger key={item} value={item}>
                  {item}
                </TabsTrigger>
              ))}
              <TabsTrigger value="all">{t("all", "All")}</TabsTrigger>
            </TabsList>
            <TabsContent value="all">
              <DocumentButton items={regularDocuments} />
            </TabsContent>
            {regularTags.map((item) => (
              <TabsContent key={item} value={item}>
                <DocumentButton
                  items={regularDocuments.filter((docs) =>
                    item ? docs.tags.includes(item) : true
                  )}
                />
              </TabsContent>
            ))}
          </Tabs>
        </>
      )}

      {clientDocuments.length > 0 && selectedClient && (
        <>
          <h2 className="flex items-center gap-1.5 font-semibold">
            {clientTag}
          </h2>
          <Tabs defaultValue={String(selectedClient.id)}>
            <TabsList className="h-full flex-wrap">
              {clientDocuments.map((document) => (
                <TabsTrigger key={document.id} value={String(document.id)}>
                  {clientLabels[document.id || 0] || document.title}
                </TabsTrigger>
              ))}
            </TabsList>
            {clientDocuments.map((document) => (
              <TabsContent key={document.id} value={String(document.id)}>
                <div className="rounded-xl border bg-background p-4">
                  <DocumentContent document={document} />
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </>
      )}

      {showTutorial && TutorialList && TutorialList?.length > 0 && (
        <>
          <h2 className="flex items-center gap-1.5 font-semibold">
            {t("tutorial", "Tutorial")}
          </h2>
          <Tabs defaultValue={TutorialList?.[0]?.title}>
            <TabsList className="h-full flex-wrap">
              {TutorialList?.map((tutorial) => (
                <TabsTrigger key={tutorial.title} value={tutorial.title}>
                  {tutorial.title}
                </TabsTrigger>
              ))}
            </TabsList>
            {TutorialList?.map((tutorial) => (
              <TabsContent key={tutorial.title} value={tutorial.title}>
                <TutorialButton
                  items={
                    tutorial.subItems && tutorial.subItems?.length > 0
                      ? tutorial.subItems
                      : [tutorial]
                  }
                  key={tutorial.path}
                />
              </TabsContent>
            ))}
          </Tabs>
        </>
      )}
    </div>
  );
}
