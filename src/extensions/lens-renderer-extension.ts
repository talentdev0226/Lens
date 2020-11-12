import type {
  AppPreferenceRegistration, ClusterFeatureRegistration,
  KubeObjectMenuRegistration, KubeObjectDetailRegistration,
  PageRegistration, StatusBarRegistration, KubeObjectStatusRegistration
} from "./registries"
import { observable } from "mobx";
import { LensExtension } from "./lens-extension"
import { ipcRenderer } from "electron"

export class LensRendererExtension extends LensExtension {
  @observable.shallow globalPages: PageRegistration[] = []
  @observable.shallow clusterPages: PageRegistration[] = []
  @observable.shallow kubeObjectStatusTexts: KubeObjectStatusRegistration[] = []
  @observable.shallow appPreferences: AppPreferenceRegistration[] = []
  @observable.shallow clusterFeatures: ClusterFeatureRegistration[] = []
  @observable.shallow statusBarItems: StatusBarRegistration[] = []
  @observable.shallow kubeObjectDetailItems: KubeObjectDetailRegistration[] = []
  @observable.shallow kubeObjectMenuItems: KubeObjectMenuRegistration[] = []

  navigate(location: string) {
    ipcRenderer.emit("renderer:navigate", location)
  }
}
