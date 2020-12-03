import { BaseClusterDetector } from "./base-cluster-detector";
import { ClusterMetadataKey } from "../cluster";

export class DistributionDetector extends BaseClusterDetector {
  key = ClusterMetadataKey.DISTRIBUTION;
  version: string;

  public async detect() {
    this.version = await this.getKubernetesVersion();

    if (this.isRke()) {
      return { value: "rke", accuracy: 80};
    }

    if (this.isK3s()) {
      return { value: "k3s", accuracy: 80};
    }

    if (this.isGKE()) {
      return { value: "gke", accuracy: 80};
    }

    if (this.isEKS()) {
      return { value: "eks", accuracy: 80};
    }

    if (this.isIKS()) {
      return { value: "iks", accuracy: 80};
    }

    if (this.isAKS()) {
      return { value: "aks", accuracy: 80};
    }

    if (this.isDigitalOcean()) {
      return { value: "digitalocean", accuracy: 90};
    }

    if (this.isMirantis()) {
      return { value: "mirantis", accuracy: 90};
    }

    if (this.isMinikube()) {
      return { value: "minikube", accuracy: 80};
    }

    if (this.isMicrok8s()) {
      return { value: "microk8s", accuracy: 80};
    }

    if (this.isKind()) {
      return { value: "kind", accuracy: 70};
    }

    if (this.isDockerDesktop()) {
      return { value: "docker-desktop", accuracy: 80};
    }

    if (this.isCustom()) {
      return { value: "custom", accuracy: 10};
    }

    return { value: "unknown", accuracy: 10};
  }

  public async getKubernetesVersion() {
    if (this.cluster.version) return this.cluster.version;

    const response = await this.k8sRequest("/version");

    return response.gitVersion;
  }

  protected isGKE() {
    return this.version.includes("gke");
  }

  protected isEKS() {
    return this.version.includes("eks");
  }

  protected isIKS() {
    return this.version.includes("IKS");
  }

  protected isAKS() {
    return this.cluster.apiUrl.endsWith("azmk8s.io");
  }

  protected isMirantis() {
    return this.version.includes("-mirantis-") || this.version.includes("-docker-");
  }

  protected isDigitalOcean() {
    return this.cluster.apiUrl.endsWith("k8s.ondigitalocean.com");
  }

  protected isMinikube() {
    return this.cluster.contextName.startsWith("minikube");
  }

  protected isMicrok8s() {
    return this.cluster.contextName.startsWith("microk8s");
  }

  protected isKind() {
    return this.cluster.contextName.startsWith("kubernetes-admin@kind-");
  }

  protected isDockerDesktop() {
    return this.cluster.contextName === "docker-desktop";
  }

  protected isCustom() {
    return this.version.includes("+");
  }

  protected isRke() {
    return this.version.includes("-rancher");
  }

  protected isK3s() {
    return this.version.includes("+k3s");
  }
}
