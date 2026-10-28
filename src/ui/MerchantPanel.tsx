import React,{useCallback,useEffect,useRef,useState}from'react';
import{Pressable,ScrollView,StyleSheet,View,useWindowDimensions}from'react-native';
import{Canvas,Atlas,FilterMode,MipmapMode,Skia,rect}from'@shopify/react-native-skia';
import{useAnimatedReaction,useSharedValue,type SharedValue}from'react-native-reanimated';
import{scheduleOnRN,scheduleOnUI}from'react-native-worklets';
import{MERCHANT_ART,MERCHANT_SOURCES,merchantFrame}from'../game/merchantAssets';
import{CELL_PACKS,MERCHANT_CONFIG,merchantOffer,type Merchant,type MerchantQuote}from'../game/merchantConfig';
import{applyMerchantPurchase,closeMerchant,merchantUnavailable,quoteMerchant}from'../game/merchantGameplay';
import{UPGRADE_INFO,type SurvivalState}from'../game/survival';
import{createRunId}from'../game/scores';
import{useSharedImage}from'./sharedImages';
import{purchaseMerchant,refundMerchant,acknowledgeMerchant,useScores}from'./ScoreStorage';
import{useGameAudio}from'./AudioProvider';
import PixelText from'./PixelText';
import UpgradeIcon from'./UpgradeIcon';
import PixelBadge from'./PixelBadge';
import{UIFrame}from'./PixelArt';

type Snapshot={merchant:Merchant|null;mode:SurvivalState['mode'];unavailable:Record<string,string|null>};
function read(s:SurvivalState):Snapshot{ 'worklet';const m=s.merchants?.active??null;return {merchant:m,mode:s.mode,unavailable:Object.fromEntries((m?.offers??[]).map(id=>[id,merchantUnavailable(s,id)]))};}
export default function MerchantPanel(props:{survival:SharedValue<SurvivalState>;clock:SharedValue<{running:boolean;firstFrame:boolean}>;resumeBlocked:SharedValue<boolean>;runId:string;visible:boolean;onClose:()=>void}){
  const [snapshot,setSnapshot]=useState(()=>read(props.survival.value));
  useAnimatedReaction(()=>{const s=props.survival.value,m=s.merchants?.active;return [s.mode,m?.id,m?.nonce,m?.sold.join(','),s.hp,s.maxHp,s.armor].join('|');},(key,old)=>{if(key!==old)scheduleOnRN(setSnapshot,read(props.survival.value));},[props.survival]);
  return props.visible&&snapshot.mode==='merchant'&&snapshot.merchant?<Shop key={snapshot.merchant.id} {...props} snapshot={snapshot}/>:null;
}
function Shop({survival,clock,resumeBlocked,runId,onClose,snapshot}:{survival:SharedValue<SurvivalState>;clock:SharedValue<{running:boolean;firstFrame:boolean}>;resumeBlocked:SharedValue<boolean>;runId:string;onClose:()=>void;snapshot:Snapshot}){
  const merchant=snapshot.merchant!,{width,height}=useWindowDimensions(),compact=width<740||height<360;
  const {archive,ready}=useScores(),audio=useGameAudio(),image=useSharedImage(MERCHANT_SOURCES[MERCHANT_ART[merchant.kind].image]);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),alive=useRef(true),locked=useRef(false);
  const live=useSharedValue(true);
  useEffect(()=>{alive.current=true;live.set(true);return()=>{alive.current=false;live.set(false);};},[live]);
  const finish=useCallback((text:string)=>{locked.current=false;if(alive.current){setBusy(false);setMessage(text);}},[]);
  const rollback=useCallback(async(q:MerchantQuote)=>{try{await refundMerchant(q.id);finish('Compra cancelada y Celdas reembolsadas.');}catch{finish('No se pudo reembolsar. Cierra y vuelve a intentarlo.');}},[finish]);
  const confirmPurchase=useCallback(async(id:string,text:string)=>{try{await acknowledgeMerchant(id);finish(text);}catch{finish('Mejora aplicada. El guardado se recuperará al reiniciar.');}},[finish]);
  const pay=useCallback(async(q:MerchantQuote)=>{
    try{
      const result=await purchaseMerchant(q);
      if(!result.ok){finish(result.message);return;}
      if(!alive.current){await refundMerchant(q.id);return;}
      const confirm=confirmPurchase,cancel=rollback;
      scheduleOnUI(()=>{'worklet';if(!live.value){scheduleOnRN(cancel,q);return;}const applied=applyMerchantPurchase(survival.value,q);if(applied.status==='invalid'){scheduleOnRN(cancel,q);return;}survival.set(applied.state);scheduleOnRN(confirm,q.id,result.message);});
    }catch{finish('No se pudo guardar la compra. Intenta de nuevo.');}
  },[finish,rollback,survival,live,confirmPurchase]);
  const buy=(itemId:string)=>{
    if(locked.current||!ready)return;locked.current=true;setBusy(true);setMessage('');audio.playUi();
    const token=runId+'/'+createRunId(),submit=pay,reject=finish;
    scheduleOnUI(()=>{'worklet';const q=quoteMerchant(survival.value,itemId,token);if(q)scheduleOnRN(submit,q);else scheduleOnRN(reject,'La oferta ya no está disponible.');});
  };
  const close=()=>{if(locked.current)return;audio.playUi();scheduleOnUI(()=>{'worklet';const next=closeMerchant(survival.value);if(next!==survival.value){resumeBlocked.set(true);clock.set({running:false,firstFrame:true});survival.set(next);scheduleOnRN(onClose);}});};
  const portraitWidth=compact?112:170,portraitHeight=compact?84:110,art=MERCHANT_ART[merchant.kind],scale=Math.min(portraitWidth/art.width,(portraitHeight-4)/art.height,2.4),source=merchantFrame(merchant.kind,merchant.ageMs);
  const title=merchant.kind==='gem'?'Celdas':merchant.kind==='fruit'?'Recuperar vida':merchant.kind==='scavenger'?'Armadura':'Suministros';
  const panelWidth=Math.min(820,width-32),cardWidth=Math.floor((panelWidth-portraitWidth-68)/2);
  const bodyHeight=Math.max(120,height-(compact?162:186));
  return <View testID="merchant-shop" accessibilityViewIsModal style={s.veil}>
    <UIFrame variant="panel" style={[s.panel,{width:panelWidth,maxHeight:height-24,padding:compact?10:16}]}>
      <View style={s.header}><PixelText text={title} size={compact?22:28} maxWidth={panelWidth-240}/><PixelText text={`${archive.economy.cells} Celdas`} size={compact?12:16} color="#dfc396"/>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar tienda" disabled={busy} onPress={close}><UIFrame variant="button" style={s.close}><PixelText text="Cerrar" size={12}/></UIFrame></Pressable>
      </View>
      {merchant.kind==='gem'&&<PixelText text="DEMO GRATIS - sin cobros ni anuncios reales. Precios propuestos en MXN." size={compact?9:11} maxWidth={panelWidth-30} color="#d1a4b8"/>}
      <View style={[s.body,{height:bodyHeight}]}>
        <View style={{width:portraitWidth,gap:10,alignItems:'center'}}>
          {image&&<Canvas style={{width:portraitWidth,height:portraitHeight}}><Atlas image={image} sprites={[rect(source.x,source.y,source.width,source.height)]} transforms={[Skia.RSXform(scale,0,(portraitWidth-art.width*scale)/2,portraitHeight-art.height*scale)]} sampling={{filter:FilterMode.Nearest,mipmap:MipmapMode.None}}/></Canvas>}
          <PixelText text={merchant.kind==='traveler'?'Dos ofertas. Solo esta partida.':merchant.kind==='fruit'?'Recupera un corazón por compra.':merchant.kind==='scavenger'?`+1 armadura. Máximo ${MERCHANT_CONFIG.armorCap}. Se pierde al recibir daño.`:'Los paquetes de prueba actualizan tu saldo.'} size={compact?9:11} maxWidth={portraitWidth} color="#b2b4aa"/>
          <PixelText text={`${Math.ceil((MERCHANT_CONFIG.lifetimeMs-merchant.ageMs)/1000)} S restantes`} size={9} maxWidth={portraitWidth} color="#9f899a"/>
        </View>
        <ScrollView testID="merchant-offers" style={{height:bodyHeight}} contentContainerStyle={s.grid}>
          {merchant.offers.map(id=>{
            const offer=merchantOffer(id)!,pack=CELL_PACKS.find(p=>p.id===id),upgrade=offer.upgrade?UPGRADE_INFO[offer.upgrade]:null;
            const claimed=offer.kind==='no-ads'&&archive.economy.adFreePreview;
            const reason=claimed?'Simulación activada.':snapshot.unavailable[id],poor=archive.economy.cells<offer.cost,disabled=busy||!ready||!!reason||poor;
            const name=upgrade?.name??pack?.name??(id==='heal'?'Un corazón':id==='armor'?'Placa protectora':'Anuncio de prueba');
            const effect=upgrade?.description??(id==='heal'?'+1 de vida':id==='armor'?'+1 de armadura':id==='ad-preview'?'+25 Celdas':id==='no-ads'?'Simulación sin anuncios':`+${offer.cells} Celdas`);
            return <Pressable key={id} testID={`merchant-buy-${id}`} accessibilityRole="button" accessibilityLabel={`Comprar ${name}`} accessibilityState={{disabled}} disabled={disabled} onPress={()=>buy(id)} style={{width:cardWidth,opacity:disabled?.55:1}}>
              <UIFrame variant="button" style={[s.card,{minHeight:compact?112:128}]}>
                {id==='armor'?<PixelBadge kind="armor"/>:<UpgradeIcon id={offer.upgrade??(offer.kind==='heal'?'heal':'xp')} size={24}/>}
                <PixelText text={name} size={compact?12:15} maxWidth={cardWidth-16}/><PixelText text={effect} size={compact?9:11} maxWidth={cardWidth-16} color="#b4d3c4"/>
                <PixelText text={reason??(poor?`Faltan ${offer.cost-archive.economy.cells} Celdas`:offer.cost?`${offer.cost} Celdas`:pack?`${pack.price} - GRATIS DEMO`:'GRATIS DEMO')} size={compact?9:11} maxWidth={cardWidth-16} color={reason||poor?'#bd8696':'#dfc396'}/>
              </UIFrame>
            </Pressable>;
          })}
        </ScrollView>
      </View>
      <PixelText text={busy?'Guardando compra...':message||'El combate está pausado.'} size={compact?9:11} maxWidth={panelWidth-30} color="#d8bbc8"/>
    </UIFrame>
  </View>;
}
const s=StyleSheet.create({veil:{...StyleSheet.absoluteFill,backgroundColor:'#030509df',justifyContent:'center',alignItems:'center'},panel:{backgroundColor:'#0c1115',gap:10},header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},close:{minHeight:44,minWidth:70,padding:8,justifyContent:'center',alignItems:'center'},body:{flexDirection:'row',gap:14},grid:{flexDirection:'row',flexWrap:'wrap',gap:10,paddingBottom:6},card:{padding:8,gap:6,justifyContent:'center'}});
