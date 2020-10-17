import * as cdk from "@aws-cdk/core";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as s3 from "@aws-cdk/aws-s3";
import * as asg from "@aws-cdk/aws-autoscaling"


import { readFileSync } from "fs";
import * as path from "path";

export class OpenvpnInfraStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "RAS-VPC", {
      cidr: "10.0.0.0/16",
      maxAzs: 1,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "VpnPrivate",
          subnetType: ec2.SubnetType.PRIVATE,
        },
        {
          cidrMask: 24,
          name: "VpnPub",
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
      enableDnsSupport: true,
    });

    const bucketFlowLogs = new s3.Bucket(this, "VPNFlowLogs");

    new ec2.FlowLog(this, "FlowLog", {
      resourceType: ec2.FlowLogResourceType.fromVpc(vpc),
      destination: ec2.FlowLogDestination.toS3(bucketFlowLogs),
    });

    const userdata = ec2.UserData.forLinux();
    userdata.addCommands(
      readFileSync(path.resolve(__dirname, "./userdata.sh"), "utf-8")
    );

    const amzn_linux = new ec2.AmazonLinuxImage({
      generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX,
      edition: ec2.AmazonLinuxEdition.STANDARD,
      virtualization: ec2.AmazonLinuxVirt.HVM,
      storage: ec2.AmazonLinuxStorage.GENERAL_PURPOSE,
    });

    const securityGroup = new ec2.SecurityGroup(this, "VPN-Instance-SG", {
      securityGroupName: "VPN-Instance-SG",
      description: "VPN Security Group",
      vpc: vpc,
    });
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), "admin port")


    const certsEBS = new ec2.Volume(this, "VPNCertsEBS", {
      size: cdk.Size.gibibytes(2),
      availabilityZone: vpc.availabilityZones[0], //TODO just receiving one
    });


    const launchTemplate = new ec2.CfnLaunchTemplate(this, "VPN-ASG-Template", {
      launchTemplateName: "VPN-ASG-Template",
      launchTemplateData: {
        keyName: "test",
        imageId: amzn_linux.getImage(this).imageId,
        instanceType: "t2.micro",
        monitoring: { enabled:true } ,
        userData: cdk.Fn.base64(userdata.render()),
        securityGroupIds: [securityGroup.securityGroupId]
      }
    })

    const autoscaling = new asg.CfnAutoScalingGroup(this, "VPN-ASG", {
      autoScalingGroupName: "VPN-ASG",
      maxSize: "1",
      minSize: "1",
      desiredCapacity: "1",
      healthCheckType: "EC2",
      launchTemplate: {
        launchTemplateName: launchTemplate.launchTemplateName,
        version: launchTemplate.attrLatestVersionNumber
      },
    })
  }
}
