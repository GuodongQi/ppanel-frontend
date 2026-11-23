"use client";

import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Sidebar, SidebarContent } from "@workspace/ui/components/sidebar";
import { isBrowser } from "@workspace/ui/utils/index";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Display } from "@/components/display";
import Recharge from "@/sections/subscribe/recharge";
import { useGlobalStore } from "@/stores/global";
import { copyText } from "@/utils/clipboard";

export function SidebarRight({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const { user } = useGlobalStore();
  const { t } = useTranslation("layout");

  return (
    <Sidebar collapsible="none" side="right" {...props}>
      <SidebarContent className="*:gap-0 *:py-0">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
            <CardTitle className="font-medium text-sm">
              {t("accountBalance", "Account Balance")}
            </CardTitle>
            <Recharge className="p-0" variant="link" />
          </CardHeader>
          <CardContent className="p-3 font-bold text-2xl">
            <Display type="currency" value={user?.balance} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-0 p-3 pb-2">
            <CardTitle className="font-medium text-sm">
              {t("giftAmount", "Gift Amount")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 font-bold text-2xl">
            <Display type="currency" value={user?.gift_amount} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-0 p-3 pb-2">
            <CardTitle className="font-medium text-sm">
              {t("commission", "Commission")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 font-bold text-2xl">
            <Display type="currency" value={user?.commission} />
          </CardContent>
        </Card>
        {user?.refer_code && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
              <CardTitle className="font-medium text-sm">
                {t("inviteCode", "Invite Code")}
              </CardTitle>
              <Button
                className="h-7 px-2"
                onClick={() => {
                  const inviteLink = `${isBrowser() ? location.origin : ""}/#/auth?invite=${user.refer_code}`;
                  copyText(inviteLink)
                    .then((copied) => {
                      if (copied) {
                        toast.success(t("copySuccess", "Invite link copied"));
                        return;
                      }
                      toast.error(t("copyFailed", "Copy failed"));
                    })
                    .catch(() => {
                      toast.error(t("copyFailed", "Copy failed"));
                    });
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                {t("copyInviteLink", "Copy Invite Link")}
              </Button>
            </CardHeader>
            <CardContent className="truncate p-3 font-bold">
              {user?.refer_code}
            </CardContent>
          </Card>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
