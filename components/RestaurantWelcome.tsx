import { Icon } from "./Brand";
import { dishImage, restaurant } from "@/lib/restaurant";

export default function RestaurantWelcome({ onStory }: { onStory: () => void }) {
  return <section id="home" className="restaurant-welcome" aria-labelledby="welcome-title">
    <img className="welcome-photo" src={dishImage("platter")} alt="صينية مندي حضرموت اليمني" fetchPriority="high"/>
    <div className="welcome-shade"/>
    <div className="container welcome-layout">
      <div className="welcome-copy">
        <p className="welcome-kicker"><span/> أصالة يمنية. ضيافة ناصرية.</p>
        <h1 id="welcome-title">حضرموت <em>اليمني</em></h1>
        <p className="welcome-tagline">مندي على الأصول… ولَمّة تطيب.</p>
        <p className="welcome-intro">حياكم على سفرتنا في الناصرية.<br/>اطلب وجبتك، تواصل ويانا، أو تعال شرّفنا.</p>
        <div className="welcome-contacts" aria-label="تواصل مع حضرموت اليمني">
          <a className="welcome-phone" href={`tel:${restaurant.phone}`} aria-label={`اتصل بالمطعم ${restaurant.phone}`}>
            <span className="contact-symbol"><Icon name="phone" size={23}/></span>
            <span className="contact-copy"><small>للطلبات والاستفسار</small><strong dir="ltr">{restaurant.phone}</strong></span>
            <span className="contact-link-label">اتصل هسه <Icon name="arrow" size={17}/></span>
          </a>
          <a className="welcome-social welcome-whatsapp" href={`https://wa.me/${restaurant.whatsapp}`} target="_blank" rel="noopener noreferrer">
            <span className="contact-symbol"><Icon name="whatsapp" size={22}/></span><span><small>نسمع منك على</small><strong>واتساب</strong></span><Icon name="arrow" size={16}/>
          </a>
          <a className="welcome-social welcome-instagram" href={restaurant.instagram} target="_blank" rel="noopener noreferrer" aria-label="إنستغرام حضرموت اليمني hadramot.na">
            <span className="contact-symbol"><Icon name="instagram" size={22}/></span><span><small>إنستغرام المطعم</small><strong dir="ltr">@hadramot.na</strong></span><Icon name="arrow" size={16}/>
          </a>
        </div>
        <div className="welcome-actions"><a href="#dishes" className="button button-gold"><Icon name="bag" size={18}/> شوف المنيو واطلب <Icon name="arrow" size={18}/></a><button className="welcome-story" onClick={onStory}>حكاية حضرموت <Icon name="arrow" size={16}/></button></div>
      </div>
      <section className="welcome-location" aria-labelledby="location-title">
        <div className="location-heading"><span className="location-symbol"><Icon name="pin" size={25}/></span><div><p>مكاننا قريب منكم</p><h2 id="location-title">تلقانا في الناصرية</h2></div><span className="location-city" dir="ltr">NASIRIYAH<br/><b>IRAQ</b></span></div>
        <div className="welcome-map"><iframe title="خريطة موقع مطعم حضرموت اليمني في الناصرية" src={restaurant.mapEmbed} loading="eager" referrerPolicy="no-referrer-when-downgrade" allowFullScreen/><a className="map-fallback" href={restaurant.map} target="_blank" rel="noopener noreferrer">عرض الخريطة بحجم أكبر <Icon name="arrow" size={13}/></a></div>
        <div className="location-address"><div><span>ننتظركم في</span><strong>شارع الإمام علي</strong></div><a href={restaurant.directions} className="location-directions" target="_blank" rel="noopener noreferrer">خذني للمطعم <Icon name="arrow" size={17}/></a></div>
        <div className="location-services"><span><Icon name="truck" size={16}/> توصيل لأحياء الناصرية</span><i/><span><Icon name="store" size={16}/> استلام من المطعم</span></div>
      </section>
      <div className="welcome-signature"><span>الطعم يمني، والكرم يجمعنا</span><span aria-hidden="true">✦</span><a href="#gathering">عندك عزيمة؟ خلّينا نرتّبها <Icon name="arrow" size={15}/></a></div>
    </div>
  </section>;
}
