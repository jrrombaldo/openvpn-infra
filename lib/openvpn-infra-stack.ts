import * as cdk from "@aws-cdk/core";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as s3 from "@aws-cdk/aws-s3";
import * as asg from "@aws-cdk/aws-autoscaling";

import { readFileSync } from "fs";
import * as path from "path";

export class OpenvpnInfraStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const keypair = new cdk.CfnParameter(this, "keypair", {
      type: "String",
      description: "keypair name",
      default: "vpn-test",
    });

    const vpc = new ec2.Vpc(this, "VPC", {
      cidr: "10.0.0.0/16",
      maxAzs: 3,
      natGateways: 3,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "Priv",
          subnetType: ec2.SubnetType.PRIVATE,
        },
        {
          cidrMask: 24,
          name: "Pub",
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

    const securityGroup = new ec2.SecurityGroup(this, "Instance-SG", {
      securityGroupName: "VPN-Instance-SG",
      description: "VPN Security Group",
      vpc: vpc,
      allowAllOutbound: true,
    });

    //TODO improve
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      "admin port"
    );

    const autoscaling = new asg.AutoScalingGroup(this, "VPN-ASG", {
      vpc: vpc, 
      vpcSubnets: vpc.selectSubnets({subnetType: ec2.SubnetType.PUBLIC}),
      associatePublicIpAddress: true,
      maxCapacity: 1,
      minCapacity: 1,
      desiredCapacity:1,
      userData: userdata,
      healthCheck:  asg.HealthCheck.ec2(),
      instanceMonitoring: asg.Monitoring.DETAILED,
      keyName: keypair.valueAsString,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.MICRO),
      machineImage: amzn_linux,
      securityGroup: securityGroup
    })
    
  }
}
